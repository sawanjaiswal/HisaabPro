/** StorefrontSettingsPage — /settings/storefront
 *
 * 4 UI states: loading skeleton / error / empty (no slug yet) / success.
 * Slug picker with live client-side validation and URL preview.
 * Products section split into StorefrontProductsSection.
 */

import { useState, useCallback } from 'react'
import { Copy, Store, Info } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useToast } from '@/hooks/useToast'
import { useStorefrontSettings } from './hooks/useStorefrontSettings'
import { StorefrontProductsSection } from './components/StorefrontProductsSection'
import { validateSlugLocal } from './slug-rules'
import type { SlugError } from './storefront.types'
import './storefront-settings.css'
import { Textarea } from '@/components/ui/Textarea'

const STORE_BASE_URL = 'hisaabpro.in/p/store/'

function slugErrorMsg(err: SlugError): string | null {
  if (err === 'INVALID_SLUG') return 'Slug must be 3-60 chars: lowercase letters, numbers and hyphens only'
  if (err === 'RESERVED_SLUG') return 'This slug is reserved — choose a different one'
  if (err === 'SLUG_TAKEN') return 'This slug is already taken — try another'
  return null
}

function SettingsSkeleton() {
  return (
    <div className="sf-skeleton" role="status" aria-label="Loading storefront settings">
      {[1, 2, 3].map(i => (
        <div key={i} className="sf-skeleton__card">
          <div className="sf-skeleton__bar sf-skeleton__bar--title" />
          <div className="sf-skeleton__bar sf-skeleton__bar--full" />
          <div className="sf-skeleton__bar sf-skeleton__bar--mid" />
        </div>
      ))}
    </div>
  )
}

function SettingsError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Couldn't load storefront settings"
      message="Please check your connection and try again."
      onRetry={onRetry}
    />
  )
}

function SettingsEmpty({ onStart }: { onStart: () => void }) {
  return (
    <EmptyState
      icon={<Store size={22} aria-hidden="true" />}
      title="Set up your online store"
      description="Pick a unique URL slug to get started — share your store with customers."
      action={
        <button type="button" className="sf-save-btn" style={{ maxWidth: 240 }} onClick={onStart}>
          Get Started
        </button>
      }
    />
  )
}

export default function StorefrontSettingsPage() {
  const toast = useToast()
  const { settings, status, saving, save, refresh, getSlugError } = useStorefrontSettings()

  const [showForm, setShowForm] = useState(false)
  const [slug, setSlug]         = useState(settings?.slug ?? '')
  const [isPublic, setIsPublic] = useState(settings?.isPublic ?? false)
  const [tagline, setTagline]   = useState(settings?.tagline ?? '')
  const [whatsapp, setWhatsapp] = useState(settings?.whatsapp ?? '')
  const [slugError, setSlugError] = useState<SlugError>(null)
  const [saveErr, setSaveErr]     = useState<SlugError>(null)
  const [synced, setSynced]       = useState(false)

  if (settings && !synced) {
    setSlug(settings.slug ?? '')
    setIsPublic(settings.isPublic)
    setTagline(settings.tagline ?? '')
    setWhatsapp(settings.whatsapp ?? '')
    setSynced(true)
  }

  const handleSlugChange = useCallback((val: string) => {
    const lower = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlug(lower)
    setSaveErr(null)
    setSlugError(lower.length > 2 ? validateSlugLocal(lower) : null)
  }, [])

  const handleSave = async () => {
    const localErr = slug.length > 2 ? validateSlugLocal(slug) : 'INVALID_SLUG'
    if (localErr) { setSlugError(localErr); return }
    setSaveErr(null)
    try {
      await save({ slug: slug || undefined, isPublic, tagline: tagline || null, whatsapp: whatsapp || null })
      setShowForm(false)
    } catch (err) {
      const code = getSlugError(err)
      if (code) setSaveErr(code)
      else toast.error('Failed to save settings')
    }
  }

  const copyUrl = useCallback(() => {
    void navigator.clipboard.writeText(`https://${STORE_BASE_URL}${slug}`)
    toast.success('Store URL copied')
  }, [slug, toast])

  const activeErr = saveErr ?? slugError

  if (status === 'loading') return (
    <AppShell><Header title="Online Store" backTo={ROUTES.SETTINGS} />
      <PageContainer><SettingsSkeleton /></PageContainer>
    </AppShell>
  )
  if (status === 'error') return (
    <AppShell><Header title="Online Store" backTo={ROUTES.SETTINGS} />
      <PageContainer><SettingsError onRetry={refresh} /></PageContainer>
    </AppShell>
  )
  if (status === 'empty' && !showForm) return (
    <AppShell><Header title="Online Store" backTo={ROUTES.SETTINGS} />
      <PageContainer><SettingsEmpty onStart={() => setShowForm(true)} /></PageContainer>
    </AppShell>
  )

  return (
    <AppShell>
      <Header title="Online Store" backTo={ROUTES.SETTINGS} />
      <PageContainer>
        <div className="sf-settings">
          <section className="sf-card" aria-labelledby="sf-basic-title">
            <h2 id="sf-basic-title" className="sf-card__title">Store Details</h2>

            <div>
              <label htmlFor="sf-slug" className="sf-label">Store URL slug *</label>
              <div className={`sf-slug-input-wrap${activeErr ? ' sf-slug-input-wrap--error' : ''}`}>
                <input
                  id="sf-slug" type="text" value={slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  placeholder="your-store-name" autoComplete="off"
                  spellCheck={false} inputMode="url" maxLength={60}
                  aria-describedby="sf-slug-help sf-slug-err"
                />
              </div>
              {activeErr ? (
                <p id="sf-slug-err" className="sf-slug-error" role="alert">{slugErrorMsg(activeErr)}</p>
              ) : null}
              <div className="sf-slug-preview">
                <span id="sf-slug-help">
                  {slug
                    ? <span className="sf-slug-preview__url">{STORE_BASE_URL}{slug}</span>
                    : <span>e.g. {STORE_BASE_URL}raju-traders</span>
                  }
                </span>
                {slug && !slugError && !saveErr && (
                  <button type="button" className="sf-copy-btn" onClick={copyUrl} aria-label="Copy store URL">
                    <Copy size={12} aria-hidden="true" /> Copy
                  </button>
                )}
              </div>
            </div>

            <div className="sf-toggle-row">
              <div>
                <p className="sf-toggle-row__label">
                  Public store
                  <span className={`sf-public-badge ${isPublic ? 'sf-public-badge--on' : 'sf-public-badge--off'}`}
                    style={{ marginLeft: 8 }}>
                    {isPublic ? 'Live' : 'Hidden'}
                  </span>
                </p>
                <p className="sf-toggle-row__desc">
                  {isPublic ? 'Anyone with the link can view your store' : 'Only you can see your store'}
                </p>
              </div>
              <label className="sf-toggle" aria-label="Toggle public store">
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                <span className="sf-toggle__track" /><span className="sf-toggle__thumb" />
              </label>
            </div>

            {!isPublic && (
              <div className="sf-hint" role="note">
                <Info size={14} aria-hidden="true" />
                Turn on Public to make your store live
              </div>
            )}

            <div>
              <label htmlFor="sf-tagline" className="sf-label">Tagline (optional)</label>
              <Textarea
                id="sf-tagline" className="sf-input" rows={2} maxLength={120}
                value={tagline} onChange={e => setTagline(e.target.value)}
                placeholder="Quality products at the best prices"
                aria-describedby="sf-tagline-count"
              />
              <p id="sf-tagline-count" className="sf-char-count">{tagline.length}/120</p>
            </div>

            <div>
              <label htmlFor="sf-whatsapp" className="sf-label">WhatsApp number (optional)</label>
              <input
                id="sf-whatsapp" type="tel" className="sf-input" value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="+919876543210" inputMode="tel"
                aria-describedby="sf-whatsapp-help"
              />
              <p id="sf-whatsapp-help" className="sf-help">
                E.164 format — customers use this for order enquiries
              </p>
            </div>

            <button
              type="button" className="sf-save-btn"
              onClick={() => { void handleSave() }}
              disabled={saving || !!slugError || slug.length < 3}
              aria-busy={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </section>

          <StorefrontProductsSection />
        </div>
      </PageContainer>
    </AppShell>
  )
}
