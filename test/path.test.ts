import { describe, expect, it } from 'vitest'
import { shortenPath } from '@/util/path'

describe('shortenPath', () => {
  it('replaces the home prefix with a tilde', () => {
    expect(shortenPath('/Users/owen/code/app', '/Users/owen')).toBe('~/code/app')
    expect(shortenPath('/Users/owen', '/Users/owen')).toBe('~')
  })

  it('leaves paths outside home alone', () => {
    expect(shortenPath('/tmp/work', '/Users/owen')).toBe('/tmp/work')
  })

  it('does not treat a same-prefixed sibling as home', () => {
    expect(shortenPath('/Users/owenautosport/x', '/Users/owen')).toBe('/Users/owenautosport/x')
  })

  it('keeps the tail of an over-long path', () => {
    const long = `/very/deep${'/nested'.repeat(12)}/end`
    const short = shortenPath(long, '/Users/owen', 20)
    expect(short).toHaveLength(20)
    expect(short.startsWith('…')).toBe(true)
    expect(short.endsWith('/end')).toBe(true)
  })

  it('returns empty for an empty path', () => {
    expect(shortenPath('', '/Users/owen')).toBe('')
  })
})
