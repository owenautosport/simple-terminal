import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { build } from 'esbuild'
import electronPath from 'electron'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * node-pty is compiled against Electron's ABI, so it cannot be loaded by plain
 * node. The driver below is bundled and executed by the Electron binary in
 * node mode — a real shell, through the real SessionRegistry.
 */
const DRIVER = `
import os from 'node:os'
import { SessionRegistry } from '${root}/src/main/sessions.ts'

const chunks = []
const registry = new SessionRegistry(
  (event) => chunks.push(event.data),
  (event) => {
    console.log('RESULT' + JSON.stringify({ exitCode: event.exitCode, output: chunks.join('') }))
    process.exit(0)
  }
)

const created = registry.create({
  sessionId: 'smoke',
  cwd: os.tmpdir(),
  shell: '/bin/bash',
  cols: 80,
  rows: 24
})

if (!created.ok) {
  console.log('RESULT' + JSON.stringify({ error: created.error }))
  process.exit(1)
}

registry.resize('smoke', 100, 30)
registry.resize('smoke', 0, 0) // must be ignored, not crash
registry.write('smoke', 'echo hello-from-pty\\r')
registry.write('smoke', 'exit\\r')

setTimeout(() => {
  console.log('RESULT' + JSON.stringify({ timedOut: true, output: chunks.join('') }))
  process.exit(2)
}, 10000)
`

let workdir: string
let bundle: string

beforeAll(async () => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-pty-'))
  const entry = path.join(workdir, 'driver.ts')
  bundle = path.join(workdir, 'driver.cjs')
  fs.writeFileSync(entry, DRIVER, 'utf8')
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundle,
    external: ['node-pty'],
    alias: { '@shared': path.join(root, 'src/shared') },
    logLevel: 'silent'
  })
}, 60000)

afterAll(() => fs.rmSync(workdir, { recursive: true, force: true }))

async function runDriver(): Promise<Record<string, unknown>> {
  const { stdout } = await run(String(electronPath), [bundle], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: path.join(root, 'node_modules') },
    cwd: root,
    timeout: 30000
  })
  const line = stdout.split('\n').find((l) => l.startsWith('RESULT'))
  if (!line) throw new Error(`driver produced no result:\n${stdout}`)
  return JSON.parse(line.slice('RESULT'.length))
}

describe('SessionRegistry against a real pty', () => {
  it('runs a command, streams its output back, and reports the exit', async () => {
    const result = await runDriver()
    expect(result.error).toBeUndefined()
    expect(result.timedOut).toBeUndefined()
    expect(String(result.output)).toContain('hello-from-pty')
    expect(result.exitCode).toBe(0)
  }, 45000)
})
