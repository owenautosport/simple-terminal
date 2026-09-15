import { describe, expect, it } from 'vitest'
import { isWebUrl, toAddress } from '@shared/url'

describe('toAddress', () => {
  it('keeps full http and https addresses as they are', () => {
    expect(toAddress('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(toAddress('http://example.com')).toBe('http://example.com')
  })

  it('adds https to a bare domain', () => {
    expect(toAddress('github.com/owenautosport')).toBe('https://github.com/owenautosport')
    expect(toAddress('  news.ycombinator.com ')).toBe('https://news.ycombinator.com')
  })

  it('uses plain http for local development servers', () => {
    expect(toAddress('localhost:5173')).toBe('http://localhost:5173')
    expect(toAddress('localhost')).toBe('http://localhost')
    expect(toAddress('127.0.0.1:8080/api')).toBe('http://127.0.0.1:8080/api')
  })

  it('treats LAN machines and named dev boxes as addresses, never searches', () => {
    expect(toAddress('192.168.1.20:8080')).toBe('http://192.168.1.20:8080')
    expect(toAddress('10.0.0.5')).toBe('http://10.0.0.5')
    expect(toAddress('devbox:3000/admin')).toBe('http://devbox:3000/admin')
    expect(toAddress('printer.local')).toBe('http://printer.local')
  })

  it('searches for anything that is not an address', () => {
    expect(toAddress('xterm webgl addon')).toBe(
      'https://www.google.com/search?q=xterm%20webgl%20addon'
    )
    expect(toAddress('electron')).toBe('https://www.google.com/search?q=electron')
  })

  it('never produces a non-web scheme', () => {
    expect(toAddress('javascript:alert(1)')).toMatch(/^https:\/\/www\.google\.com\/search\?q=/)
    expect(toAddress('file:///etc/passwd')).toMatch(/^https:\/\/www\.google\.com\/search\?q=/)
  })

  it('returns null for empty input', () => {
    expect(toAddress('   ')).toBeNull()
  })
})

describe('isWebUrl', () => {
  it('accepts only http and https', () => {
    expect(isWebUrl('https://example.com')).toBe(true)
    expect(isWebUrl('http://localhost:3000')).toBe(true)
    expect(isWebUrl('file:///etc/passwd')).toBe(false)
    expect(isWebUrl('javascript:alert(1)')).toBe(false)
    expect(isWebUrl('not a url')).toBe(false)
  })
})
