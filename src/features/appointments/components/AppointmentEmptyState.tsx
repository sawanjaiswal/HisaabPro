/** AppointmentEmptyState — used by DayListView when there are 0 rows. */

import { CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface AppointmentEmptyStateProps {
  onCreate: () => void
}

export function AppointmentEmptyState({ onCreate }: AppointmentEmptyStateProps) {
  const { t } = useLanguage()
  return (
    <EmptyState
      icon={<CalendarClock size={22} aria-hidden="true" />}
      title={t.appointmentEmptyTitle ?? 'No appointments yet'}
      description={t.appointmentEmptyDesc ?? 'Tap an empty hour to add a slot, or use the button below.'}
      action={
        <Button variant="primary" onClick={onCreate}>
          {t.appointmentEmptyAction ?? 'New appointment'}
        </Button>
      }
    />
  )
}
