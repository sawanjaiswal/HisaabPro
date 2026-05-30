/**
 * PinPad — controlled 3x4 numeric keypad with dot indicators.
 *
 * Pure presentational component. State (value, length cap, error shake,
 * locked-disable) all flow in via props; key events flow out via onKeyPress.
 * The hosting sheet owns the keyboard listener that calls onKeyPress for
 * physical keys, so the keypad itself stays free of global side effects.
 */

import { useEffect, useRef } from 'react'
import { Delete } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import {
  KEYPAD_BACKSPACE,
  KEYPAD_KEYS,
} from '../pin-gate.constants'
import './pin-pad.css'
import { Button } from '@/components/ui/Button'

export interface PinPadProps {
  /** Current value — drives the dot indicators. */
  value: string
  /** Total dot slots to render. Typically PIN_MAX_LEN = 6. */
  length: number
  /**
   * Fired on every digit press AND on the backspace key. The backspace key
   * sends the KEYPAD_BACKSPACE sentinel; everything else is a single digit.
   */
  onKeyPress: (key: string) => void
  /** When true, apply the shake animation class (cleared by the parent after the animation). */
  error?: boolean
  /** Disable every key during lockout / submission. */
  disabled?: boolean
}

export function PinPad({ value, length, onKeyPress, error, disabled }: PinPadProps) {
  const { t } = useLanguage()
  const rootRef = useRef<HTMLDivElement>(null)

  // Re-run the shake animation each time `error` flips true.  CSS animations
  // only fire on the initial class application — restarting requires a
  // reflow. Setting then immediately clearing data-shake achieves that.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !error) return
    root.classList.remove('pin-pad--shake')
    // Reading offsetWidth forces a synchronous reflow so the next class addition
    // is treated as a new animation start by the browser.
    void root.offsetWidth
    root.classList.add('pin-pad--shake')
  }, [error])

  return (
    <div ref={rootRef} className="pin-pad py-0" aria-live="polite">
      {/* Dot indicators — filled = entered, outline = empty */}
      <div className="pin-pad-dots py-0" role="img" aria-label={t.pinPadDotsAria}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`pin-pad-dot py-0 ${i < value.length ? 'pin-pad-dot--filled' : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* 3x4 keypad */}
      <div className="pin-pad-grid py-0" role="group" aria-label={t.pinPadKeypadAria}>
        {KEYPAD_KEYS.map((key, i) => {
          if (key === '') {
            // Empty bottom-left slot keeps the grid aligned.
            return <span key={`spacer-${i}`} className="pin-pad-spacer py-0" aria-hidden="true" />
          }
          if (key === KEYPAD_BACKSPACE) {
            return (
              <Button variant="none"
                key={key}
                type="button"
                className="pin-pad-key pin-pad-key--util py-0"
                onClick={() => onKeyPress(KEYPAD_BACKSPACE)}
                disabled={disabled || value.length === 0}
                aria-label={t.pinPadBackspaceAria}
              >
                <Delete size={20} aria-hidden="true" />
              </Button>
            )
          }
          return (
            <Button variant="none"
              key={key}
              type="button"
              className="pin-pad-key py-0"
              onClick={() => onKeyPress(key)}
              disabled={disabled}
              aria-label={`${t.pinPadKeyAria} ${key}`}
            >
              <span aria-hidden="true">{key}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
