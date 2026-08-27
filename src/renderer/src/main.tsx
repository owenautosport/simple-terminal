import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import '@/styles.css'
import { App } from '@/App'

// Deliberately not StrictMode: its double-invoked effects would spawn and kill a
// second pty for every pane on mount.
createRoot(document.getElementById('root')!).render(<App />)
