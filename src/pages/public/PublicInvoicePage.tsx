/** PublicInvoicePage — /p/invoice/:token
 *
 * Fetches GET /api/p/invoice/:token (no auth required).
 * 4 UI states: loading | error-expired | error-notfound | success.
 * Supports ?lang=hi via outlet context from PublicShell.
 * Mobile-first, 320px minimum.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { Clock, Link2Off, SearchX, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicInvoiceView } from '@/features/public/components/PublicInvoiceView'
import type { PublicInvoiceDto } from '@/features/invoices/share-links.service'
import type { PublicLang } from '@/features/public/hooks/usePublicLang'
import './public-invoice.css'

// ─── Strings (no LanguageContext — public surface) ───────────────────────────

const STRINGS = {
  en: {
    loading:         'Loading invoice...',
    expired:         'This link has expired',
    expiredMsg:      'The person who shared this invoice can generate a new link.',
    revoked:         'This link has been revoked',
    revokedMsg:      'The person who shared this invoice has revoked access.',
    notFound:        'Invoice link not found',
    notFoundMsg:     'No invoice was found at this link.',
    loadFailed:      'Couldn\'t load this invoice',
    loadFailedMsg:   'Please try again or ask for a new link.',
    retry:           'Try Again',
  },
  hi: {
    loading:         'बीजक लोड हो रहा है...',
    expired:         'यह लिंक समाप्त हो गया है',
    expiredMsg:      'जिस व्यक्ति ने यह बीजक साझा किया था, वे नया लिंक बना सकते हैं।',
    revoked:         'यह लिंक रद्द कर दिया गया है',
    revokedMsg:      'जिस व्यक्ति ने यह बीजक साझा किया था, उन्होंने एक्सेस रद्द कर दी है।',
    notFound:        'बीजक लिंक नहीं मिला',
    notFoundMsg:     'इस लिंक पर कोई बीजक नहीं मिला।',
    loadFailed:      'यह बीजक लोड नहीं हो सका',
    loadFailedMsg:   'कृपया पुनः प्रयास करें या नया लिंक माँगें।',
    retry:           'पुनः प्रयास',
  },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type FetchStatus = 'loading' | 'expired' | 'revoked' | 'not-found' | 'error' | 'success'

interface OutletCtx {
  lang: PublicLang
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>()
  const ctx = useOutletContext<OutletCtx>()
  const lang: PublicLang = ctx?.lang ?? 'en'
  const s = STRINGS[lang]

  const [status, setStatus] = useState<FetchStatus>('loading')
  const [invoice, setInvoice] = useState<PublicInvoiceDto | null>(null)

  const doFetch = useCallback(async () => {
    if (!token) { setStatus('not-found'); return }
    setStatus('loading')
    setInvoice(null)
    try {
      const data = await api<PublicInvoiceDto>(`/p/invoice/${token}`)
      setInvoice(data)
      setStatus('success')
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 410) setStatus('expired')
      else if (status === 404) setStatus('not-found')
      else setStatus('error')
    }
  }, [token])

  useEffect(() => {
    void doFetch()
  }, [doFetch])

  /* ── Loading ── */
  if (status === 'loading') {
    return (
      <div className="pub-invoice-skeleton" role="status" aria-label={s.loading} aria-live="polite">
        <div className="pub-invoice-skeleton__bar pub-invoice-skeleton__bar--wide" />
        <div className="pub-invoice-skeleton__bar pub-invoice-skeleton__bar--mid" />
        <div className="pub-invoice-skeleton__bar pub-invoice-skeleton__bar--full pub-invoice-skeleton__bar--tall" />
        <div className="pub-invoice-skeleton__bar pub-invoice-skeleton__bar--short" />
        <div className="pub-invoice-skeleton__bar pub-invoice-skeleton__bar--full" />
        <div className="pub-invoice-skeleton__bar pub-invoice-skeleton__bar--full" />
        <div className="pub-invoice-skeleton__bar pub-invoice-skeleton__bar--mid" />
      </div>
    )
  }

  /* ── Expired ── */
  if (status === 'expired') {
    return (
      <div className="pub-invoice-status" role="alert">
        <div className="pub-invoice-status__icon pub-invoice-status__icon--warn" aria-hidden="true">
          <Clock size={28} />
        </div>
        <p className="pub-invoice-status__title">{s.expired}</p>
        <p className="pub-invoice-status__message">{s.expiredMsg}</p>
      </div>
    )
  }

  /* ── Revoked ── */
  if (status === 'revoked') {
    return (
      <div className="pub-invoice-status" role="alert">
        <div className="pub-invoice-status__icon pub-invoice-status__icon--warn" aria-hidden="true">
          <Link2Off size={28} />
        </div>
        <p className="pub-invoice-status__title">{s.revoked}</p>
        <p className="pub-invoice-status__message">{s.revokedMsg}</p>
      </div>
    )
  }

  /* ── Not found ── */
  if (status === 'not-found') {
    return (
      <div className="pub-invoice-status" role="alert">
        <div className="pub-invoice-status__icon pub-invoice-status__icon--error" aria-hidden="true">
          <SearchX size={28} />
        </div>
        <p className="pub-invoice-status__title">{s.notFound}</p>
        <p className="pub-invoice-status__message">{s.notFoundMsg}</p>
      </div>
    )
  }

  /* ── Generic error ── */
  if (status === 'error') {
    return (
      <div className="pub-invoice-status" role="alert">
        <div className="pub-invoice-status__icon pub-invoice-status__icon--error" aria-hidden="true">
          <AlertCircle size={28} />
        </div>
        <p className="pub-invoice-status__title">{s.loadFailed}</p>
        <p className="pub-invoice-status__message">{s.loadFailedMsg}</p>
        <button
          type="button"
          className="pub-invoice-status__retry"
          onClick={() => { void doFetch() }}
        >
          {s.retry}
        </button>
      </div>
    )
  }

  /* ── Success ── */
  if (status === 'success' && invoice) {
    return <PublicInvoiceView invoice={invoice} lang={lang} />
  }

  return null
}
