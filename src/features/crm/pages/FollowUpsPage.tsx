/**
 * CRM (#127) — FollowUpsPage.
 *
 * The CRM hub landing surface. Shows parties due for a check-in within a
 * configurable window (7 / 30 / 90 days). Architecture §3.5 / M3 enforces
 * `withinDays ≤ 365` — the chip-bar maxes out at 90 so the user never hits
 * the cap, but the hook + service clamp regardless for defence in depth.
 *
 * 4 UI states mandated by PAGE_AUDIT_CHECKLIST §G:
 *   - Loading  → Skeleton x3 rows
 *   - Error    → ErrorState w/ retry (special copy for INVALID_WITHIN_DAYS_RANGE)
 *   - Empty    → EmptyState w/ Add Follow-up CTA (links to Parties)
 *   - Success  → list of <FollowUpRow>
 *
 * All four visible at 320px (manually verified — see hp-design checklist).
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, ListChecks } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useFollowUps } from '../hooks/useFollowUps'
import { FollowUpRow } from '../components/FollowUpRow'
import type { WithinDaysPreset } from '../crm.types'
import '@/styles/components.crm.css'

const RANGE_PRESETS: { value: WithinDaysPreset; key: 'crmFollowUpsRange7' | 'crmFollowUpsRange30' | 'crmFollowUpsRange90' }[] = [
  { value: 7,  key: 'crmFollowUpsRange7'  },
  { value: 30, key: 'crmFollowUpsRange30' },
  { value: 90, key: 'crmFollowUpsRange90' },
]

export default function FollowUpsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [withinDays, setWithinDays] = useState<WithinDaysPreset>(30)
  const { data, isLoading, isError, isRangeError, refetch } = useFollowUps({ withinDays })

  return (
    <AppShell>
      <Header title={t.crmFollowUpsTitle} backTo={ROUTES.PARTIES} />

      <PageContainer variant="list" className="space-y-6">
        <div className="follow-ups-page__intro">
          <ClipboardCheck size={20} aria-hidden="true" className="follow-ups-page__intro-icon" />
          <p className="follow-ups-page__subtitle">{t.crmFollowUpsSubtitle}</p>
        </div>

        <div
          className="follow-ups-page__range-bar"
          role="tablist"
          aria-label={t.crmFollowUpsRangeLabel}
        >
          <span className="follow-ups-page__range-label">{t.crmFollowUpsRangeLabel}</span>
          {RANGE_PRESETS.map((preset) => (
            <Button variant="none"
              key={preset.value}
              type="button"
              role="tab"
              aria-selected={withinDays === preset.value}
              className={`follow-ups-page__range-chip${
                withinDays === preset.value ? ' follow-ups-page__range-chip--active' : ''
              }`}
              onClick={() => setWithinDays(preset.value)}
            >
              {t[preset.key]}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="follow-ups-page__skeleton" role="status" aria-busy="true">
            <Skeleton height="4.5rem" borderRadius="var(--radius-lg)" count={3} />
          </div>
        )}

        {isError && (
          <ErrorState
            title={t.crmFollowUpsErrorTitle}
            message={isRangeError ? t.crmWithinDaysExceedsMax : t.checkConnectionRetry}
            onRetry={refetch}
            retryLabel={t.crmFollowUpsRetry}
          />
        )}

        {!isLoading && !isError && data && data.rows.length === 0 && (
          <EmptyState
            icon={<ListChecks size={40} aria-hidden="true" />}
            title={t.crmFollowUpQueueEmpty}
            description={t.crmFollowUpsSubtitle}
            action={
              <Button
                type="button"
                variant="primary" size="md"
                onClick={() => navigate(ROUTES.PARTIES)}
                aria-label={t.parties}
              >
                {t.parties}
              </Button>
            }
          />
        )}

        {!isLoading && !isError && data && data.rows.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {t.crmFollowUpsTotalCount.replace('{n}', String(data.totalCount))}
            </div>
            <ol className="follow-ups-page__list" aria-label={t.crmFollowUpsTitle}>
              {data.rows.map((row) => (
                <li key={row.id} className="follow-ups-page__list-item">
                  <FollowUpRow row={row} />
                </li>
              ))}
            </ol>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
