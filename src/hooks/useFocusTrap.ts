/**
 * useFocusTrap — keyboard focus trap for modal/dialog containers.
 *
 * Traps Tab/Shift+Tab within the ref'd element, calls onEscape on Escape
 * (unless disabled), saves + restores the previously focused element,
 * and locks body scroll while active.
 *
 * Usage:
 *   const ref = useRef<HTMLElement>(null)
 *   useFocusTrap(ref, { active: open, onEscape: onDismiss, disabled: isPending })
 */

import { useRef, useEffect, useCallback } from 'react'

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface UseFocusTrapOptions {
  /** Whether the trap is active. */
  active: boolean
  /** Called when Escape is pressed (and not disabled). */
  onEscape?: () => void
  /** When true, Escape key is suppressed (e.g. during async loading). */
  disabled?: boolean
  /** Focus this element on open instead of the first focusable child. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  /** Lock body scroll while active. Defaults to true. */
  lockScroll?: boolean
}

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions,
): void {
  const { active, onEscape, disabled = false, initialFocusRef, lockScroll = true } = options
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const getFocusable = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return []
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS))
  }, [containerRef])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!disabled) onEscape?.()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [disabled, onEscape, getFocusable],
  )

  useEffect(() => {
    if (!active) return

    previousFocusRef.current = document.activeElement as HTMLElement
    if (lockScroll) document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    // Focus initial element after paint
    const id = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
      } else {
        const focusable = getFocusable()
        if (focusable.length > 0) focusable[0].focus()
        else containerRef.current?.focus()
      }
    }, 50)

    return () => {
      clearTimeout(id)
      document.removeEventListener('keydown', handleKeyDown)
      if (lockScroll) document.body.style.overflow = ''
      previousFocusRef.current?.focus()
    }
  }, [active, handleKeyDown, getFocusable, initialFocusRef, containerRef, lockScroll])
}
