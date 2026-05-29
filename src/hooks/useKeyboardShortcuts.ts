/** Global keyboard-shortcut listener.
 *
 * Wires the modifier-based entries of DEFAULT_SHORTCUTS to real actions
 * (navigation, new-invoice, calculator toggle). Bare-key billing shortcuts
 * (Enter/Tab/Escape/save/print) stay form-native and are intentionally not
 * handled here — only combos carrying ctrl/meta/alt are matched, which also
 * makes the listener safe to leave active while the user types in a field.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { CALCULATOR_TOGGLE_EVENT } from '@/config/events.config'
import { DEFAULT_SHORTCUTS } from '@/features/settings/shortcut.constants'
import type { ShortcutConfig } from '@/features/settings/settings.types'

type ShortcutAction = (navigate: ReturnType<typeof useNavigate>) => void

// Only ids with a real, app-wide target are wired. Anything absent here
// (global.search has no palette yet; billing.* are form-context) is ignored.
const SHORTCUT_ACTIONS: Record<string, ShortcutAction> = {
  'navigation.dashboard': (nav) => nav(ROUTES.DASHBOARD),
  'navigation.invoices': (nav) => nav(ROUTES.INVOICES),
  'navigation.parties': (nav) => nav(ROUTES.PARTIES),
  'navigation.inventory': (nav) => nav(ROUTES.PRODUCTS),
  'navigation.reports': (nav) => nav(ROUTES.REPORTS),
  'billing.newInvoice': (nav) => nav(ROUTES.INVOICE_CREATE),
  'global.calculator': () => window.dispatchEvent(new Event(CALCULATOR_TOGGLE_EVENT)),
}

function matches(config: ShortcutConfig, e: KeyboardEvent): boolean {
  const wantCtrl = config.ctrl === true
  const wantAlt = config.alt === true
  const hasCtrl = e.ctrlKey || e.metaKey
  if (wantCtrl !== hasCtrl) return false
  if (wantAlt !== e.altKey) return false
  return e.key.toLowerCase() === config.key.toLowerCase()
}

export function useKeyboardShortcuts(enabled = true): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Ignore bare keypresses — every wired shortcut carries a modifier.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) return

      for (const [id, action] of Object.entries(SHORTCUT_ACTIONS)) {
        const config = DEFAULT_SHORTCUTS[id]
        if (config && matches(config, e)) {
          e.preventDefault()
          action(navigate)
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, enabled])
}
