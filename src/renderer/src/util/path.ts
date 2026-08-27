/** `/Users/owen/code` under home becomes `~/code`; long paths keep their tail. */
export function shortenPath(fullPath: string, home: string, maxLength = 44): string {
  if (!fullPath) return ''

  let display = fullPath
  if (home && (fullPath === home || fullPath.startsWith(`${home}/`))) {
    display = `~${fullPath.slice(home.length)}`
  }

  if (display.length <= maxLength) return display
  // Keep the end of the path: the last segments say where you are.
  return `…${display.slice(display.length - maxLength + 1)}`
}
