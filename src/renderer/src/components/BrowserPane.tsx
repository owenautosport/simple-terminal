import { useEffect, useRef, useState } from 'react'
import type { PaneMeta } from '@shared/types'
import { WEB_PANE_PARTITION, toAddress } from '@shared/url'
import { PaneActions } from './PaneActions'
import { BackIcon, CloseIcon, ForwardIcon, ReloadIcon, StopIcon } from './icons'

/** The parts of Electron's <webview> element this pane uses. */
interface WebviewElement extends HTMLElement {
  loadURL(url: string): Promise<void>
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  reload(): void
  stop(): void
  findInPage(text: string, options?: { forward?: boolean; findNext?: boolean }): number
  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void
}

export interface BrowserHandle {
  reload: () => void
  focusAddress: () => void
  /** Opens the find bar over the page. */
  find: () => void
}

interface Props {
  paneId: string
  meta: PaneMeta
  focused: boolean
  zoomed: boolean
  onFocus: () => void
  onSplit: (dir: 'h' | 'v') => void
  onZoom: () => void
  onClose: () => void
  onToggleKind: () => void
  onVisit: (url: string) => void
  onPageTitle: (title: string) => void
  registerBrowser: (paneId: string, handle: BrowserHandle | null) => void
}

/** Common local dev servers, offered when a web pane has nothing to show yet. */
const LOCAL = ['localhost:3000', 'localhost:5173', 'localhost:8080']

/**
 * Lets target=_blank links ask for a window at all; the main process then refuses
 * the window and opens the link in the same pane. A string, because React drops a
 * `true` it does not recognise, and Electron only checks the attribute is present.
 */
const ALLOW_POPUPS = { allowpopups: 'true' } as unknown as { allowpopups: boolean }

/**
 * A web page in a pane. The address the pane last showed is kept in its metadata;
 * the page itself is live only while the pane is showing the web.
 */
export function BrowserPane(props: Props): React.JSX.Element {
  const { paneId, focused } = props
  // Set once: changing the src attribute later would fight in-page navigation.
  const [src, setSrc] = useState(props.meta.url)
  const [address, setAddress] = useState(props.meta.url ?? '')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [nav, setNav] = useState({ back: false, forward: false })
  const [failure, setFailure] = useState<string | null>(null)
  const [finding, setFinding] = useState(false)
  const [matches, setMatches] = useState<{ active: number; total: number } | null>(null)
  const findRef = useRef<HTMLInputElement>(null)
  const viewRef = useRef<WebviewElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  // Set when the click that focused this pane landed in one of its text fields.
  const clickedFieldRef = useRef(false)
  const readyRef = useRef(false)

  const callbacks = useRef(props)
  callbacks.current = props

  const go = (input: string): void => {
    const url = toAddress(input)
    if (!url) return
    setFailure(null)
    setAddress(url)
    setEditing(false)
    const view = viewRef.current
    if (view && readyRef.current) void view.loadURL(url).catch(() => undefined)
    else setSrc(url)
    callbacks.current.onVisit(url)
  }

  useEffect(() => {
    callbacks.current.registerBrowser(paneId, {
      reload: () => viewRef.current?.reload(),
      focusAddress: () => {
        inputRef.current?.focus()
        inputRef.current?.select()
      },
      find: () => {
        if (!viewRef.current || !readyRef.current) return
        setFinding(true)
        requestAnimationFrame(() => findRef.current?.select())
      }
    })
    return () => callbacks.current.registerBrowser(paneId, null)
  }, [paneId])

  // Page events, wired once the <webview> exists.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    readyRef.current = false

    const refreshNav = (): void => {
      if (!readyRef.current) return
      setNav({ back: view.canGoBack(), forward: view.canGoForward() })
    }
    const onReady = (): void => {
      readyRef.current = true
      refreshNav()
    }
    const onNavigate = (event: Event): void => {
      const { url, isMainFrame } = event as Event & { url: string; isMainFrame?: boolean }
      if (isMainFrame === false) return
      setFailure(null)
      setAddress((current) => (document.activeElement === inputRef.current ? current : url))
      callbacks.current.onVisit(url)
      refreshNav()
    }
    const onStart = (): void => setLoading(true)
    const onStop = (): void => {
      setLoading(false)
      refreshNav()
    }
    const onTitle = (event: Event): void =>
      callbacks.current.onPageTitle((event as Event & { title: string }).title)
    const onFail = (event: Event): void => {
      const { errorCode, errorDescription, validatedURL, isMainFrame } = event as Event & {
        errorCode: number
        errorDescription: string
        validatedURL: string
        isMainFrame: boolean
      }
      // -3 is an aborted load: a new navigation replaced it, which is not a failure.
      if (!isMainFrame || errorCode === -3) return
      setFailure(`${validatedURL} could not be opened (${errorDescription || errorCode}).`)
    }
    const onFound = (event: Event): void => {
      const { result } = event as Event & {
        result: { activeMatchOrdinal: number; matches: number; finalUpdate: boolean }
      }
      if (result.finalUpdate) setMatches({ active: result.activeMatchOrdinal, total: result.matches })
    }
    const onFocus = (): void => callbacks.current.onFocus()
    // A click into a page that already held keyboard focus raises no focus event on
    // the element, but the app document still blurs as input moves to the guest.
    const onWindowBlur = (): void => {
      setTimeout(() => {
        if (document.activeElement === view) callbacks.current.onFocus()
      }, 0)
    }
    window.addEventListener('blur', onWindowBlur)

    view.addEventListener('dom-ready', onReady)
    view.addEventListener('did-navigate', onNavigate)
    view.addEventListener('did-navigate-in-page', onNavigate)
    view.addEventListener('did-start-loading', onStart)
    view.addEventListener('did-stop-loading', onStop)
    view.addEventListener('page-title-updated', onTitle)
    view.addEventListener('did-fail-load', onFail)
    view.addEventListener('focus', onFocus)
    view.addEventListener('found-in-page', onFound)
    return () => {
      view.removeEventListener('found-in-page', onFound)
      window.removeEventListener('blur', onWindowBlur)
      view.removeEventListener('dom-ready', onReady)
      view.removeEventListener('did-navigate', onNavigate)
      view.removeEventListener('did-navigate-in-page', onNavigate)
      view.removeEventListener('did-start-loading', onStart)
      view.removeEventListener('did-stop-loading', onStop)
      view.removeEventListener('page-title-updated', onTitle)
      view.removeEventListener('did-fail-load', onFail)
      view.removeEventListener('focus', onFocus)
    }
  }, [src === undefined])

  // Keyboard focus follows pane focus: the page if there is one, else the address bar.
  // A click into a text field keeps it: focusing the page is asynchronous (the page
  // lives in another process), so it would land after the click and steal it back.
  useEffect(() => {
    const clickedField = clickedFieldRef.current
    clickedFieldRef.current = false
    if (!focused || clickedField || paneRef.current?.contains(document.activeElement)) return
    if (viewRef.current) viewRef.current.focus()
    else inputRef.current?.focus()
  }, [focused, src === undefined])

  function closeFind(): void {
    viewRef.current?.stopFindInPage('clearSelection')
    setFinding(false)
    setMatches(null)
    viewRef.current?.focus()
  }

  return (
    <div
      ref={paneRef}
      className={`pane pane--web${focused ? ' pane--focused' : ''}`}
      onMouseDown={(event) => {
        // Only a click that is about to focus the pane runs the effect that reads this.
        clickedFieldRef.current = !focused && (event.target as HTMLElement).closest('input') !== null
        props.onFocus()
      }}
      data-pane-id={paneId}
    >
      <div className="pane__bar">
        <span className="pane__nav">
          <button
            type="button"
            className="pane__btn"
            disabled={!nav.back}
            onClick={() => viewRef.current?.goBack()}
            title="Back"
            aria-label="Back"
          >
            <BackIcon size={14} />
          </button>
          <button
            type="button"
            className="pane__btn"
            disabled={!nav.forward}
            onClick={() => viewRef.current?.goForward()}
            title="Forward"
            aria-label="Forward"
          >
            <ForwardIcon size={14} />
          </button>
          <button
            type="button"
            className="pane__btn"
            disabled={!src}
            onClick={() => (loading ? viewRef.current?.stop() : viewRef.current?.reload())}
            title={loading ? 'Stop loading' : 'Reload (⌘R)'}
            aria-label={loading ? 'Stop loading' : 'Reload'}
          >
            {loading ? <StopIcon size={14} /> : <ReloadIcon size={14} />}
          </button>
        </span>
        <form
          className="pane__address"
          onSubmit={(event) => {
            event.preventDefault()
            go(address)
          }}
        >
          <input
            ref={inputRef}
            value={editing ? address : prettyAddress(address)}
            placeholder="Search or enter an address"
            spellCheck={false}
            onFocus={(event) => {
              setEditing(true)
              requestAnimationFrame(() => event.target.select())
            }}
            onBlur={() => setEditing(false)}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setAddress(props.meta.url ?? '')
                event.currentTarget.blur()
              }
            }}
            aria-label="Address"
          />
          {loading && <span className="pane__loading" aria-hidden="true" />}
        </form>
        <PaneActions
          kind="browser"
          zoomed={props.zoomed}
          onToggleKind={props.onToggleKind}
          onSplit={props.onSplit}
          onZoom={props.onZoom}
          onClose={props.onClose}
        />
      </div>

      <div className="pane__web">
        {src ? (
          <webview
            ref={(element: HTMLElement | null) => {
              viewRef.current = element as WebviewElement | null
            }}
            src={src}
            partition={WEB_PANE_PARTITION}
            {...ALLOW_POPUPS}
          />
        ) : (
          <div className="pane__start">
            <p>Search, or type an address in the bar above.</p>
            <div className="pane__local">
              {LOCAL.map((host) => (
                <button key={host} type="button" onClick={() => go(host)}>
                  {host}
                </button>
              ))}
            </div>
          </div>
        )}
        {finding && (
          <div className="pane__search pane__search--web">
            <input
              ref={findRef}
              placeholder="Find in page"
              spellCheck={false}
              onChange={(event) => {
                const text = event.target.value
                const view = viewRef.current
                if (!view) return
                if (text) view.findInPage(text)
                else {
                  view.stopFindInPage('clearSelection')
                  setMatches(null)
                }
              }}
              onKeyDown={(event) => {
                const text = event.currentTarget.value
                if (event.key === 'Enter' && text) {
                  viewRef.current?.findInPage(text, { forward: !event.shiftKey, findNext: true })
                }
                if (event.key === 'Escape') closeFind()
              }}
            />
            {matches && (
              <span className="pane__matches">
                {matches.total ? `${matches.active} of ${matches.total}` : 'No matches'}
              </span>
            )}
            <button type="button" onClick={closeFind} aria-label="Close find">
              <CloseIcon size={12} />
            </button>
          </div>
        )}
        {failure && (
          <div className="pane__failure" role="alert">
            <span>{failure}</span>
            <button type="button" onClick={() => viewRef.current?.reload()}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The address as it reads best when not being edited: no scheme, no trailing slash. */
function prettyAddress(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
