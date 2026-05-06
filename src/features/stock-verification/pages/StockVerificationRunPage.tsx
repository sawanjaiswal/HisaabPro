/** Stock Verification Run Page — mobile-first counting UI with search, delta indicators, finalize */

import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, CheckCircle2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ROUTES } from '@/config/routes.config'
import { useVerificationDetail } from '../useVerificationDetail'
import { CountItemRow } from '../components/CountItemRow'
import type { VerificationItem } from '../stock-verification.types'
import { useLanguage } from '@/hooks/useLanguage'
import '../stock-verification.css'
import './stock-verification-run.css'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function matchesSearch(item: VerificationItem, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  const name = (item.product?.name ?? '').toLowerCase()
  const sku = (item.product?.sku ?? '').toLowerCase()
  return name.includes(lower) || sku.includes(lower)
}

function buildFinalizeDesc(items: VerificationItem[], t: Record<string, string>): string {
  const adjusted = items.filter(
    (i) => i.actualQuantity !== null && i.actualQuantity !== i.expectedQuantity,
  )
  if (adjusted.length === 0) return t.countFinalizeNoChange ?? ''
  const net = adjusted.reduce((sum, i) => sum + ((i.actualQuantity ?? 0) - i.expectedQuantity), 0)
  const netStr = net >= 0 ? `+${net}` : String(net)
  return (t.countFinalizeDesc ?? '')
    .replace('{adjusted}', String(adjusted.length))
    .replace('{net}', netStr)
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StockVerificationRunPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { verification, items, status, error, refetch, recordCount, completeVerification, adjustStock, isProcessing } =
    useVerificationDetail(id)

  const [search, setSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const filteredItems = useMemo(
    () => items.filter((item) => matchesSearch(item, search)),
    [items, search],
  )

  const hasAnyCount = items.some((i) => i.actualQuantity !== null)

  const finalizeDesc = useMemo(
    () => buildFinalizeDesc(items, t as unknown as Record<string, string>),
    [items, t],
  )

  const handleFinalize = async () => {
    setShowConfirm(false)
    await completeVerification()
    await adjustStock()
    navigate(ROUTES.STOCK_VERIFICATION, { replace: true })
  }

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.stockCountHeading} backTo={ROUTES.INVENTORY_VERIFY} />
        <PageContainer>
          <div aria-busy="true" className="sv-run__skeleton">
            <Skeleton height="2.5rem" borderRadius="var(--radius-md)" />
            <Skeleton height="5rem" borderRadius="var(--radius-md)" count={4} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.stockCountHeading} backTo={ROUTES.INVENTORY_VERIFY} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadVerification} message={error?.message} onRetry={refetch} />
        </PageContainer>
      </AppShell>
    )
  }

  if (!verification) return null

  const countedLabel = (t.itemsCountedLabel ?? '{counted} of {total} counted')
    .replace('{counted}', String(verification.countedItems))
    .replace('{total}', String(verification.totalItems))

  const isFinalized = verification.status === 'COMPLETED'

  return (
    <AppShell>
      <Header
        title={t.stockCountHeading}
        backTo={ROUTES.INVENTORY_VERIFY}
        actions={
          <span className="sv-run__progress-badge">{countedLabel}</span>
        }
      />

      <PageContainer className="sv-run__container">
        {/* Search bar */}
        <div className="sv-run__search-wrap">
          <Search size={18} className="sv-run__search-icon" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            className="sv-run__search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchProductsPlaceholder}
            aria-label={t.searchProductsPlaceholder}
          />
        </div>

        {/* Count rows */}
        {filteredItems.length === 0 && (
          <p className="sv-run__empty">{t.noProductsFound}</p>
        )}

        <div className="sv-run__list stagger-list">
          {filteredItems.map((item) => (
            <CountItemRow
              key={item.id}
              item={item}
              onSave={recordCount}
              disabled={isProcessing || isFinalized}
            />
          ))}
        </div>

        {/* Sticky finalize footer */}
        {!isFinalized && (
          <div className="sv-run__footer">
            <button
              type="button"
              className="sv-run__finalize-btn"
              onClick={() => setShowConfirm(true)}
              disabled={!hasAnyCount || isProcessing}
              aria-busy={isProcessing}
            >
              <CheckCircle2 size={20} aria-hidden="true" />
              {isProcessing ? t.finalizingCount : t.finalizeCountBtn}
            </button>
          </div>
        )}

        {isFinalized && (
          <div className="sv-run__finalized-banner" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            {t.countFinalized}
          </div>
        )}
      </PageContainer>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => void handleFinalize()}
        title={t.countFinalizeTitle}
        description={finalizeDesc}
        confirmLabel={t.confirmFinalize}
        isDanger={false}
        isLoading={isProcessing}
      />
    </AppShell>
  )
}
