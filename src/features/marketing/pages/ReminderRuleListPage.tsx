/** ReminderRuleListPage — /marketing/reminders */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Bell } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { useReminderRuleList, useDeleteReminderRule, useToggleReminderRule } from '../hooks/useReminderRules'
import { ReminderRuleCard } from '../components/ReminderRuleCard'
import { MARKETING_ROUTES } from '../marketing.constants'
import type { ReminderRule } from '../marketing.types'
import '../marketing.css'

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="reminder-list" aria-busy="true" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height="80px" borderRadius="var(--radius-xl)" />
      ))}
    </div>
  )
}

export default function ReminderRuleListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { rules, status, refresh } = useReminderRuleList()
  const deleteMutation = useDeleteReminderRule()
  const toggleMutation = useToggleReminderRule()
  const [confirmDelete, setConfirmDelete] = useState<ReminderRule | null>(null)

  const goNew = () => navigate(MARKETING_ROUTES.REMINDER_NEW)

  return (
    <AppShell>
      <Header title={t.marketingReminderRulesTitle} backTo={MARKETING_ROUTES.HUB} />
      <HeroPage>
        {status === 'loading' && <ListSkeleton label={t.marketingReminderLoadingAria as string} />}

        {status === 'error' && (
          <ErrorState message={t.marketingReminderLoadFailed} onRetry={refresh} />
        )}

        {status === 'success' && rules.length === 0 && (
          <EmptyState
            icon={<Bell size={22} aria-hidden="true" />}
            title={t.marketingNoRemindersYet}
            description={t.marketingNoRemindersDesc}
            action={
              <Button variant="primary" size="md" onClick={goNew}>
                {t.marketingCreateRule}
              </Button>
            }
          />
        )}

        {status === 'success' && rules.length > 0 && (
          <div className="reminder-list stagger-list" role="list" aria-label={t.marketingReminderRulesTitle}>
            {rules.map((rule) => (
              <div key={rule.id} role="listitem">
                <ReminderRuleCard
                  rule={rule}
                  toggling={toggleMutation.isPending}
                  onToggle={(r) => toggleMutation.mutate({ id: r.id, name: r.name })}
                  onEdit={(r) => navigate(MARKETING_ROUTES.REMINDER_EDIT.replace(':id', r.id))}
                  onDelete={setConfirmDelete}
                />
              </div>
            ))}
          </div>
        )}
      </HeroPage>

      {status === 'success' && rules.length > 0 && (
        <Button variant="none" className="fab" onClick={goNew} aria-label={t.marketingReminderNewAria}>
          <Plus size={24} aria-hidden="true" />
        </Button>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate({ id: confirmDelete.id, name: confirmDelete.name })
          setConfirmDelete(null)
        }}
        title={t.marketingDeleteRuleTitle}
        description={t.marketingDeleteRuleDesc}
        confirmLabel={t.marketingDelete}
        cancelLabel={t.marketingCancel}
        isLoading={deleteMutation.isPending}
      />
    </AppShell>
  )
}
