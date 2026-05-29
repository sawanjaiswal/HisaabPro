/** PublicStorePage — /p/store/:slug
 *
 * Fetches GET /api/p/store/:slug via api() — no auth.
 * 4 states: loading | not-found | empty (no products) | success.
 * ?lang=hi via PublicShell outlet context.
 * 320px minimum, UPI deep-link sticky button.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { Package, SearchX, AlertCircle, MessageCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatPaise } from '@/lib/format'
import type { PublicStorefrontDto, PublicStoreStatus } from '@/features/storefront/storefront.types'
import type { PublicLang } from '@/features/public/hooks/usePublicLang'
import './public-store.css'

// ─── Strings ──────────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    loading:      'Loading store...',
    notFound:     'Store not found',
    notFoundMsg:  'This store link doesn\'t exist or the store has been made private.',
    empty:        'No products yet',
    emptyMsg:     'This store hasn\'t added any products yet. Check back soon!',
    loadFailed:   'Couldn\'t load this store',
    loadFailedMsg:'Please try again.',
    retry:        'Try Again',
    enquire:      'Enquire',
    payCta:       'Pay via UPI',
  },
  hi: {
    loading:      'स्टोर लोड हो रहा है...',
    notFound:     'स्टोर नहीं मिला',
    notFoundMsg:  'यह स्टोर लिंक मौजूद नहीं है या स्टोर प्राइवेट किया गया है।',
    empty:        'अभी कोई उत्पाद नहीं',
    emptyMsg:     'इस स्टोर में अभी कोई उत्पाद नहीं जुड़ा है। जल्द वापस देखें!',
    loadFailed:   'यह स्टोर लोड नहीं हो सका',
    loadFailedMsg:'कृपया पुनः प्रयास करें।',
    retry:        'पुनः प्रयास',
    enquire:      'पूछताछ करें',
    payCta:       'UPI से भुगतान करें',
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhatsAppUrl(whatsapp: string, bizName: string, productName: string): string {
  const text = encodeURIComponent(`Hi! I'm interested in "${productName}" from ${bizName}. Please share details.`)
  const num = whatsapp.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${text}`
}

function buildUpiUrl(upiVpa: string): string {
  return `upi://pay?pa=${encodeURIComponent(upiVpa)}&cu=INR`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StoreSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className="pub-store-skeleton__header" />
      <div className="pub-store-skeleton__grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pub-store-skeleton__card">
            <div className="pub-store-skeleton__img" />
            <div className="pub-store-skeleton__text" />
            <div className="pub-store-skeleton__text pub-store-skeleton__text--short" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Status screen ────────────────────────────────────────────────────────────

function StoreStatusScreen({
  icon, title, msg, onRetry, retryLabel,
}: {
  icon: React.ReactNode
  title: string
  msg: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="pub-store-status" role="alert">
      <div className="pub-store-status__icon pub-store-status__icon--error" aria-hidden="true">
        {icon}
      </div>
      <p className="pub-store-status__title">{title}</p>
      <p className="pub-store-status__msg">{msg}</p>
      {onRetry && retryLabel && (
        <button type="button" className="pub-store-status__retry" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OutletCtx { lang: PublicLang }

export function PublicStorePage() {
  const { slug } = useParams<{ slug: string }>()
  const ctx = useOutletContext<OutletCtx>()
  const lang: PublicLang = ctx?.lang ?? 'en'
  const s = STRINGS[lang]

  const [uiStatus, setUiStatus] = useState<PublicStoreStatus>('loading')
  const [store, setStore] = useState<PublicStorefrontDto | null>(null)

  const fetchStore = useCallback(async () => {
    if (!slug) { setUiStatus('not-found'); return }
    setUiStatus('loading')
    setStore(null)
    try {
      const data = await api<PublicStorefrontDto>(`/p/store/${slug}`)
      setStore(data)
      setUiStatus(data.products.length === 0 ? 'empty' : 'success')
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 404) setUiStatus('not-found')
      else setUiStatus('error')
    }
  }, [slug])

  useEffect(() => { void fetchStore() }, [fetchStore])

  if (uiStatus === 'loading') return <StoreSkeleton label={s.loading} />

  if (uiStatus === 'not-found') return (
    <StoreStatusScreen
      icon={<SearchX size={28} />}
      title={s.notFound}
      msg={s.notFoundMsg}
    />
  )

  if (uiStatus === 'error') return (
    <StoreStatusScreen
      icon={<AlertCircle size={28} />}
      title={s.loadFailed}
      msg={s.loadFailedMsg}
      onRetry={() => { void fetchStore() }}
      retryLabel={s.retry}
    />
  )

  if (uiStatus === 'empty' && store) return (
    <>
      <div className="pub-store__header">
        {store.business.logoUrl
          ? <img src={store.business.logoUrl} alt={store.business.name} className="pub-store__logo" />
          : <div className="pub-store__logo-placeholder" aria-hidden="true">
              {store.business.name.charAt(0).toUpperCase()}
            </div>
        }
        <h1 className="pub-store__biz-name">{store.business.name}</h1>
        {store.tagline && <p className="pub-store__tagline">{store.tagline}</p>}
      </div>
      <StoreStatusScreen
        icon={<Package size={28} />}
        title={s.empty}
        msg={s.emptyMsg}
      />
    </>
  )

  if (uiStatus === 'success' && store) {
    const hasUpi = !!store.business.upiVpa
    return (
      <div className="pub-store">
        <header className="pub-store__header">
          {store.business.logoUrl
            ? <img src={store.business.logoUrl} alt={store.business.name} className="pub-store__logo" />
            : <div className="pub-store__logo-placeholder" aria-hidden="true">
                {store.business.name.charAt(0).toUpperCase()}
              </div>
          }
          <h1 className="pub-store__biz-name">{store.business.name}</h1>
          {store.tagline && <p className="pub-store__tagline">{store.tagline}</p>}
        </header>

        <div className="pub-store__body">
          <ul className="pub-store__grid" aria-label="Products">
            {store.products.map(product => (
              <li key={product.id} className="pub-store__product-card">
                {product.imageUrl
                  ? <img src={product.imageUrl} alt={product.name} className="pub-store__product-img" loading="lazy" />
                  : (
                    <div className="pub-store__product-img-placeholder" aria-hidden="true">
                      <Package size={32} />
                    </div>
                  )
                }
                <div className="pub-store__product-body">
                  <p className="pub-store__product-name">{product.name}</p>
                  <p className="pub-store__product-price">{formatPaise(product.sellingPrice)}</p>
                  {store.whatsapp && (
                    <a
                      href={buildWhatsAppUrl(store.whatsapp, store.business.name, product.name)}
                      className="pub-store__enquire-btn"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Enquire about ${product.name} via WhatsApp`}
                    >
                      <MessageCircle size={14} aria-hidden="true" />
                      {s.enquire}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {hasUpi && (
          <div className="pub-store__upi-bar">
            <a
              href={buildUpiUrl(store.business.upiVpa!)}
              className="pub-store__upi-btn"
              aria-label={`Pay ${store.business.name} via UPI`}
            >
              {s.payCta}
            </a>
          </div>
        )}
      </div>
    )
  }

  return null
}
