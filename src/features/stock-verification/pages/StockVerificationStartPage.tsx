/** Stock Verification Start Page — name your count + optional category filter → create draft */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useLanguage } from '@/hooks/useLanguage'
import '../stock-verification.css'
import './stock-verification-start.css'

export default function StockVerificationStartPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = name.trim().length >= 2 && !isSubmitting

  const handleStart = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      const result = await api<{ id: string }>('/stock-verification', {
        method: 'POST',
        body: JSON.stringify({ notes: name.trim() }),
        entityType: 'stock-count',
        entityLabel: name.trim(),
      })
      toast.success(t.countStarted)
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockVerification.all() })
      // Navigate to the mobile count flow
      const runPath = ROUTES.INVENTORY_VERIFY_RUN.replace(':id', result.id)
      navigate(runPath, { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t.countStartFailed
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleStart()
  }

  return (
    <AppShell>
      <Header title={t.startCountTitle} backTo={ROUTES.STOCK_VERIFICATION} />
      <PageContainer>
        <div className="sv-start">
          <div className="sv-start__icon" aria-hidden="true">
            <ClipboardList size={32} />
          </div>

          <p className="sv-start__hint">{t.filterByCategoryHint}</p>

          <div className="sv-start__form">
            <div className="sv-start__field">
              <label htmlFor="count-name" className="sv-start__label">
                {t.countNameLabel}
                <span className="sv-start__required" aria-hidden="true"> *</span>
              </label>
              <input
                id="count-name"
                type="text"
                className="sv-start__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.countNamePlaceholder}
                maxLength={120}
                autoComplete="off"
                autoFocus
                aria-required="true"
                aria-describedby="count-name-hint"
              />
              <span id="count-name-hint" className="sv-start__field-hint">
                {t.filterByCategoryLabel}
              </span>
            </div>

            <button
              type="button"
              className="sv-start__submit"
              onClick={() => void handleStart()}
              disabled={!canSubmit}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? t.startingCount : t.startCountBtn}
            </button>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  )
}
