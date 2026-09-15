/** Address-bar maths for web panes, shared so the main process can apply the same rule. */

/** The one session every web pane shares, so a login survives a restart. */
export const WEB_PANE_PARTITION = 'persist:web-panes'

const SEARCH = 'https://www.google.com/search?q='
/**
 * Machines on this computer or this network: loopback, any IPv4 address, `.local`
 * names, and a bare hostname with a port (`devbox:3000`). They get plain http, and
 * are never sent to a search engine.
 */
const LOCAL_HOST =
  /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[::1\]|[a-z0-9-]+\.local|[a-z0-9-]+(?=:\d))(:\d+)?(\/.*)?$/i
const BARE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i

export function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Turns what someone typed into an address: a URL as-is, a domain, a dev server, or a search. */
export function toAddress(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  if (/^https?:\/\//i.test(text) && isWebUrl(text)) return text
  if (!/\s/.test(text)) {
    if (LOCAL_HOST.test(text)) return `http://${text}`
    if (BARE_DOMAIN.test(text)) return `https://${text}`
  }
  return SEARCH + encodeURIComponent(text)
}
