/** Ledger — Empty state */

import { BookOpen } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/feedback/EmptyState'

export function LedgerEmpty() {
  const { t } = useLanguage()
  return (
    <EmptyState
      icon={<BookOpen size={22} aria-hidden="true" />}
      title={t.ledgerEmptyTitle}
      description={t.ledgerEmptyBody}
    />
  )
}
