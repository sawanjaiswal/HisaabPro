import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { getBusinessInitials, getBusinessColor } from './business.utils'
import { BusinessSwitcher } from './components/BusinessSwitcher'
import './business.css'

// Vertical distance required to commit a swipe. Horizontal movement above the
// max threshold cancels the gesture (treated as a scroll).
const SWIPE_THRESHOLD = 24
const SWIPE_MAX_HORIZONTAL = 20

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(ms) } catch { /* noop */ }
  }
}

export function BusinessAvatar() {
  const { user, businesses, isSwitching, switchBusiness } = useAuth()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [swipeHint, setSwipeHint] = useState<'up' | 'down' | null>(null)
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null)
  const gestureHandled = useRef(false)
  const hintTimer = useRef<number | null>(null)

  const activeBusiness = businesses.find(b => b.id === user?.businessId) ?? businesses[0]
  const hasMultiple = businesses.length > 1

  useEffect(() => () => {
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
  }, [])

  const clearHintSoon = useCallback(() => {
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setSwipeHint(null), 320)
  }, [])

  const cycle = useCallback((direction: 1 | -1) => {
    if (isSwitching || !hasMultiple || !activeBusiness) return
    const idx = businesses.findIndex(b => b.id === activeBusiness.id)
    if (idx < 0) return
    const nextIdx = (idx + direction + businesses.length) % businesses.length
    const next = businesses[nextIdx]
    if (!next || next.id === activeBusiness.id) return
    vibrate(12)
    setSwipeHint(direction === 1 ? 'down' : 'up')
    clearHintSoon()
    void switchBusiness(next.id).catch(() => setSwipeHint(null))
  }, [activeBusiness, businesses, hasMultiple, isSwitching, switchBusiness, clearHintSoon])

  const handleTap = useCallback(() => {
    if (gestureHandled.current) {
      gestureHandled.current = false
      return
    }
    if (hasMultiple) setShowSwitcher(true)
  }, [hasMultiple])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!hasMultiple) return
    pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    gestureHandled.current = false
    // Capture so pointermove/up keep firing on this element even if the pointer
    // leaves the avatar mid-swipe (common on desktop mouse drags).
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }, [hasMultiple])

  const releaseCapture = (el: Element, id: number) => {
    try { (el as HTMLElement).releasePointerCapture(id) } catch { /* noop */ }
  }

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const start = pointerStart.current
    pointerStart.current = null
    releaseCapture(e.currentTarget, e.pointerId)
    if (!start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > SWIPE_MAX_HORIZONTAL) return
    if (Math.abs(dy) < SWIPE_THRESHOLD) return
    gestureHandled.current = true
    // Swipe down → next business; swipe up → previous (Gmail-style).
    cycle(dy > 0 ? 1 : -1)
  }, [cycle])

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    pointerStart.current = null
    releaseCapture(e.currentTarget, e.pointerId)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!hasMultiple) return
    if (e.key === 'ArrowDown') { e.preventDefault(); cycle(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cycle(-1) }
  }, [hasMultiple, cycle])

  if (!activeBusiness) return null

  const initials = getBusinessInitials(activeBusiness.name)
  const color = getBusinessColor(activeBusiness.id)

  return (
    <>
      <div
        className={`business-avatar-container${swipeHint ? ` business-avatar-container--swipe-${swipeHint}` : ''}`}
      >
        <button
          type="button"
          className={`business-avatar${isSwitching ? ' business-avatar--switching' : ''}`}
          style={{ background: color, touchAction: 'pan-x' }}
          onClick={handleTap}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label={
            hasMultiple
              ? `${activeBusiness.name}. Tap to switch business, or press Up/Down to cycle`
              : activeBusiness.name
          }
          aria-keyshortcuts={hasMultiple ? 'ArrowUp ArrowDown' : undefined}
          aria-busy={isSwitching || undefined}
        >
          {initials}
        </button>
        {hasMultiple && (
          <div className="business-dots" aria-hidden="true">
            {businesses.slice(0, 3).map(b => (
              <span
                key={b.id}
                className={`business-dot${b.id === activeBusiness.id ? ' business-dot--active' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      {showSwitcher && createPortal(
        <BusinessSwitcher onClose={() => setShowSwitcher(false)} />,
        document.body
      )}
    </>
  )
}

export default BusinessAvatar
