/** Ledger — Empty state */

import { BookOpen } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export function LedgerEmpty() {
  const { t } = useLanguage()
  return (
    <div className="ledger-empty" role="status">
      <BookOpen size={40} aria-hidden="true" className="ledger-empty__icon" />
      <p className="ledger-empty__title">{t.ledgerEmptyTitle}</p>
      <p className="ledger-empty__body">{t.ledgerEmptyBody}</p>
    </div>
  )
}
