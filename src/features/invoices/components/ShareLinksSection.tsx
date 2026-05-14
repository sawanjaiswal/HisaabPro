/** ShareLinksSection — Public share link panel inside ShareInvoiceDrawer
 *
 * 4 states: loading (skeleton) | error | empty (generate only) | success (list).
 * Issues and revokes share links via useDocumentShareLinks.
 * The generated URL is shown once — user must copy immediately.
 */

import { useState, useCallback } from 'react'
import { Link2, Copy } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useDocumentShareLinks } from '../hooks/useDocumentShareLinks'
import type { ShareLinkTtl } from '../share-links.service'
import '../invoice-share-links.css'

interface ShareLinksSectionProps {
  documentId: string
  documentNumber: string
}

type TtlOption = { value: ShareLinkTtl; labelKey: keyof ReturnType<typeof useLanguage>['t'] }

const TTL_OPTIONS: TtlOption[] = [
  { value: 7,   labelKey: 'shareLinkExpiry7d' },
  { value: 30,  labelKey: 'shareLinkExpiry30d' },
  { value: 90,  labelKey: 'shareLinkExpiry90d' },
  { value: null, labelKey: 'shareLinkExpiryNever' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ShareLinksSection({ documentId, documentNumber }: ShareLinksSectionProps) {
  const { t } = useLanguage()
  const toast = useToast()

  const { activeLinks, isLoading, isError, issue, revoke } = useDocumentShareLinks(
    documentId,
    documentNumber
  )

  const [selectedTtl, setSelectedTtl] = useState<ShareLinkTtl>(30)
  const [oneTimeUrl, setOneTimeUrl] = useState<string | null>(null)
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setOneTimeUrl(null)
    try {
      const result = await issue.mutateAsync(selectedTtl)
      if (result && result.url) {
        setOneTimeUrl(result.url)
      }
    } catch {
      // error toast handled by hook
    }
  }, [issue, selectedTtl])

  const handleCopy = useCallback(async () => {
    if (!oneTimeUrl) return
    try {
      await navigator.clipboard.writeText(oneTimeUrl)
      toast.success(t.shareLinkCopied)
    } catch {
      toast.error('Could not copy — please copy the link manually')
    }
  }, [oneTimeUrl, toast, t.shareLinkCopied])

  const handleRevokeConfirm = useCallback(async () => {
    if (!revokeTargetId) return
    setRevokeTargetId(null)
    try {
      await revoke.mutateAsync(revokeTargetId)
    } catch {
      // error toast handled by hook
    }
  }, [revoke, revokeTargetId])

  const isBusy = issue.isPending || revoke.isPending

  return (
    <section className="share-links" aria-label={t.shareLinkSectionTitle}>
      <h3 className="share-links__heading">
        <Link2 size={14} aria-hidden="true" />
        {t.shareLinkSectionTitle}
      </h3>

      {/* ── Expiry picker ── */}
      <p className="share-links__expiry-label">{t.shareLinkExpiryLabel}</p>
      <div className="share-links__pills" role="group" aria-label={t.shareLinkExpiryLabel}>
        {TTL_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            className={`share-links__pill${selectedTtl === opt.value ? ' share-links__pill--active' : ''}`}
            aria-pressed={selectedTtl === opt.value}
            onClick={() => setSelectedTtl(opt.value)}
            disabled={isBusy}
          >
            {t[opt.labelKey] as string}
          </button>
        ))}
      </div>

      {/* ── Generate button ── */}
      <button
        type="button"
        className="share-links__generate-btn"
        onClick={() => { void handleGenerate() }}
        disabled={isBusy}
        aria-busy={issue.isPending}
      >
        {issue.isPending ? t.shareLinkGenerating : t.shareLinkGenerate}
      </button>

      {/* ── One-time URL reveal ── */}
      {oneTimeUrl && (
        <div className="share-links__one-time" role="alert">
          <p className="share-links__one-time-hint">{t.shareLinkCopiedOnce}</p>
          <p className="share-links__one-time-url">{oneTimeUrl}</p>
          <button
            type="button"
            className="share-links__copy-btn"
            onClick={() => { void handleCopy() }}
          >
            <Copy size={12} aria-hidden="true" />
            {t.shareLinkCopy}
          </button>
        </div>
      )}

      {/* ── 4 states: loading | error | empty | list ── */}
      {isLoading && (
        <div aria-busy="true" aria-label="Loading links">
          <div className="share-links__skeleton-row" style={{ marginTop: 'var(--space-4)' }} />
          <div className="share-links__skeleton-row" style={{ marginTop: 'var(--space-2)' }} />
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState
          title={t.shareLinkLoadError}
          message=""
        />
      )}

      {!isLoading && !isError && activeLinks.length > 0 && (
        <>
          <p className="share-links__list-title">{t.shareLinkActiveLinks}</p>
          <ul className="share-links__list" role="list">
            {activeLinks.map((link) => {
              const countLabel = (t.shareLinkAccessCount ?? 'Opened {count} times').replace(
                '{count}',
                String(link.accessCount)
              )
              return (
                <li key={link.id} className="share-links__item">
                  <div className="share-links__item-meta">
                    <span className="share-links__item-date">
                      Created {formatDate(link.createdAt)}
                    </span>
                    <span className="share-links__item-expires">
                      {link.expiresAt
                        ? `Expires ${formatDate(link.expiresAt)}`
                        : t.shareLinkExpiryNever}
                    </span>
                    <span className="share-links__item-count">{countLabel}</span>
                  </div>
                  <button
                    type="button"
                    className="share-links__revoke-btn"
                    onClick={() => setRevokeTargetId(link.id)}
                    disabled={isBusy}
                    aria-label={`${t.shareLinkRevoke} — created ${formatDate(link.createdAt)}`}
                  >
                    {t.shareLinkRevoke}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* ── Revoke confirm dialog ── */}
      <ConfirmDialog
        open={!!revokeTargetId}
        onClose={() => setRevokeTargetId(null)}
        onConfirm={() => { void handleRevokeConfirm() }}
        title={t.shareLinkRevoke}
        description={t.shareLinkRevokeConfirm}
        confirmLabel={t.shareLinkRevoke}
        cancelLabel={t.cancel ?? 'Cancel'}
        isLoading={revoke.isPending}
      />
    </section>
  )
}
