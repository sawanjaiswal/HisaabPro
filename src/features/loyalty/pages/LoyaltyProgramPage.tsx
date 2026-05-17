/**
 * Loyalty #125 — Settings page (route: /settings/loyalty).
 *
 * 4 UI states (Rule G):
 *   loading  → skeleton stack
 *   error    → ErrorState onRetry
 *   empty    → never (program endpoint always returns null or DTO — null is
 *              still valid initial state and renders the form pre-seeded with
 *              defaults via the LoyaltyProgramForm)
 *   success  → form
 */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useLoyaltyProgram } from '../hooks/useLoyaltyProgram'
import { LoyaltyProgramForm } from '../components/LoyaltyProgramForm'

export default function LoyaltyProgramPage() {
  const { t } = useLanguage()
  const { program, isLoading, isError, refetch } = useLoyaltyProgram()

  return (
    <AppShell>
      <Header title={t.loyaltyProgramHeader} backTo={ROUTES.SETTINGS} />

      <PageContainer variant="form">
        {isLoading && (
          <div
            aria-busy="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            {[56, 88, 56, 56, 56, 56, 48].map((h, i) => (
              <Skeleton key={i} height={`${h}px`} borderRadius="var(--radius-md)" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState message={t.loyaltyLoadFailed} onRetry={refetch} />
        )}

        {!isLoading && !isError && (
          <>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--fs-sm)',
                marginBottom: 'var(--space-4)',
              }}
            >
              {t.loyaltyProgramDescription}
            </p>
            <LoyaltyProgramForm program={program} />
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
