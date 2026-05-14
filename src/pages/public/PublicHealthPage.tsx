/**
 * PublicHealthPage — /p/health smoke page.
 *
 * Fetches GET /api/p/health via api() (offline queue + retry included).
 * 4 UI states: loading | error | empty (unreachable) | success.
 *
 * Console clean: all fetch errors routed through state — no unhandled
 * promise rejections.
 */

import { useEffect, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '@/lib/api'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { PublicLang } from '@/features/public/hooks/usePublicLang'

interface HealthRes {
  success: boolean
  data?: { status: string }
}

interface OutletCtx {
  lang: PublicLang
}

type FetchState = 'loading' | 'success' | 'error'

const STRINGS = {
  en: {
    publicSurfaceReady: 'Public surface ready',
    loading: 'Checking service...',
    errorTitle: 'Service unavailable',
    errorMsg: 'Could not reach the public API. Please try again.',
    retry: 'Retry',
  },
  hi: {
    publicSurfaceReady: 'सार्वजनिक सतह तैयार',
    loading: 'सेवा जांच रहे हैं...',
    errorTitle: 'सेवा उपलब्ध नहीं',
    errorMsg: 'सार्वजनिक API तक नहीं पहुंचा जा सका। कृपया पुनः प्रयास करें।',
    retry: 'पुनः प्रयास',
  },
} as const

export function PublicHealthPage() {
  const ctx = useOutletContext<OutletCtx>()
  const lang: PublicLang = ctx?.lang ?? 'en'
  const s = STRINGS[lang]

  const [state, setState] = useState<FetchState>('loading')

  const doFetch = useCallback(async () => {
    setState('loading')
    try {
      const res = await api<HealthRes>('/p/health')
      if (res && res.success !== false) {
        setState('success')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  /* ── Loading ── */
  if (state === 'loading') {
    return (
      <div className="public-health" role="status" aria-live="polite" aria-label={s.loading}>
        <div className="public-health__skeleton" aria-hidden="true" />
        <p className="public-health__status" style={{ color: 'var(--color-gray-400)' }}>
          {s.loading}
        </p>
      </div>
    )
  }

  /* ── Error ── */
  if (state === 'error') {
    return (
      <div className="public-health">
        <ErrorState
          title={s.errorTitle}
          message={s.errorMsg}
          onRetry={doFetch}
          retryLabel={s.retry}
        />
      </div>
    )
  }

  /* ── Success ── */
  return (
    <div className="public-health" role="status" aria-live="polite">
      <div className="public-health__badge" aria-label={s.publicSurfaceReady}>
        <span className="public-health__dot" aria-hidden="true" />
        {s.publicSurfaceReady}
      </div>
    </div>
  )
}
