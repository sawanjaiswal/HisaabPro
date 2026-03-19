import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// TypeScript declarations for the Turnstile script injected via CDN
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: TurnstileOptions): string
      remove(widgetId: string): void
    }
  }
}

interface TurnstileOptions {
  sitekey: string
  callback: (token: string) => void
  'expired-callback'?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TurnstileProps {
  onVerify: (token: string) => void
  onExpire?: () => void
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
const SCRIPT_ID = 'cf-turnstile-script'

export function Turnstile({ onVerify, onExpire }: TurnstileProps) {
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Dev mode — skip when no sitekey is configured
    if (!sitekey) return

    // Load Turnstile script once
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }

    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: sitekey!,
        callback: onVerify,
        'expired-callback': onExpire,
        theme: 'light',
      })
    }

    // Turnstile may already be loaded (e.g. hot reload) — render immediately
    let scriptEl: HTMLScriptElement | null = null
    if (window.turnstile) {
      renderWidget()
    } else {
      scriptEl = document.getElementById(SCRIPT_ID) as HTMLScriptElement
      scriptEl.addEventListener('load', renderWidget)
    }

    return () => {
      // Remove listener to prevent firing on unmounted component
      if (scriptEl) {
        scriptEl.removeEventListener('load', renderWidget)
      }
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [onVerify, onExpire, sitekey])

  // Dev mode — render nothing when no sitekey
  if (!sitekey) return null

  return <div ref={containerRef} />
}
