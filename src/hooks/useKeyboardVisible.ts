import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Returns true while the on-screen keyboard is up.
 *
 * - Native (iOS/Android via Capacitor): listens to `@capacitor/keyboard`
 *   `keyboardWillShow` / `keyboardWillHide` events.
 * - Web fallback: uses `visualViewport` resize — when the visual viewport
 *   shrinks by more than 150px (typical keyboard height), assume keyboard.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let onShow: { remove: () => Promise<void> } | undefined
      let onHide: { remove: () => Promise<void> } | undefined
      let cancelled = false

      void import('@capacitor/keyboard').then(({ Keyboard }) => {
        if (cancelled) return
        void Keyboard.addListener('keyboardWillShow', () => setVisible(true)).then((h) => { onShow = h })
        void Keyboard.addListener('keyboardWillHide', () => setVisible(false)).then((h) => { onHide = h })
      })

      return () => {
        cancelled = true
        void onShow?.remove()
        void onHide?.remove()
      }
    }

    const vv = window.visualViewport
    if (!vv) return

    const baseline = vv.height
    const onResize = () => {
      const shrunk = baseline - vv.height
      setVisible(shrunk > 150)
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  return visible
}
