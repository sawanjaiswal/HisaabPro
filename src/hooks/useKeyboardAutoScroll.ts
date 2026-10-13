import { useEffect } from 'react'

/**
 * useKeyboardAutoScroll — Level 6 UX SSOT for Mobile Virtual Keyboard Focus
 *
 * Automatically monitors focusin events on all text/number/search inputs,
 * textareas, and select elements across the application. When a field in the
 * lower portion of the screen is focused on mobile/tablet:
 *
 * 1. Waits for the virtual keyboard show animation tick (~180ms - 250ms).
 * 2. Smoothly scrolls the element into clear view with breathing room above
 *    both the on-screen keyboard and any fixed bottom action bars.
 * 3. Prevents inputs from being hidden behind Android's IME window.
 */
export function useKeyboardAutoScroll(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      const tagName = target.tagName.toLowerCase()
      const isInput =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable

      if (!isInput) return

      // Delay to allow Android keyboard to finish opening and viewport to adjust
      const timer = window.setTimeout(() => {
        try {
          const rect = target.getBoundingClientRect()
          const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight

          // If the element is positioned in the lower half of the available visible space
          if (rect.bottom > viewportHeight * 0.55 || rect.top < 70) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            })
          }
        } catch {
          // Fallback if scrollIntoView options are unsupported
          target.scrollIntoView(true)
        }
      }, 220)

      const handleBlur = () => {
        window.clearTimeout(timer)
        target.removeEventListener('focusout', handleBlur)
      }
      target.addEventListener('focusout', handleBlur, { once: true })
    }

    document.addEventListener('focusin', handleFocusIn, { passive: true })
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
    }
  }, [])
}
