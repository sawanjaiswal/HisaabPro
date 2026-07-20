/** Left-edge swipe-to-go-back gesture (iOS/Android convention).
 *
 * A touch that STARTS within the left edge zone and travels rightward past the
 * trigger distance — mostly horizontal, within a short time window — pops one
 * history entry. Guarded so it never fires at the history root (would exit the
 * app) and never on multi-touch (pinch/zoom). Passive listeners: we never call
 * preventDefault, so native scrolling is untouched. */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const EDGE_ZONE_PX = 24 // how close to the left edge the touch must start
const TRIGGER_PX = 72 // minimum rightward travel to count as a back-swipe
const MAX_OFF_AXIS = 0.6 // |dy| must stay under dx * this (keeps it horizontal)
const MAX_DURATION_MS = 600 // a flick, not a slow drag

export function useEdgeSwipeBack(enabled = true): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) return

    let startX = 0
    let startY = 0
    let startedAt = 0
    let armed = false

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        armed = false
        return
      }
      const touch = e.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      startedAt = Date.now()
      armed = touch.clientX <= EDGE_ZONE_PX
    }

    const onEnd = (e: TouchEvent) => {
      if (!armed) return
      armed = false
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = Math.abs(touch.clientY - startY)
      const dt = Date.now() - startedAt
      const horizontal = dx >= TRIGGER_PX && dy <= dx * MAX_OFF_AXIS
      if (horizontal && dt <= MAX_DURATION_MS && window.history.length > 1) {
        navigate(-1)
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [enabled, navigate])
}
