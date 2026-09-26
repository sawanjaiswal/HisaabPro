/** Ledger — Empty state */

import { BookOpen, RotateCcw } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'

interface LedgerEmptyProps {
  isFiltered?: boolean
  onResetFilter?: () => void
}

export function LedgerEmpty({ isFiltered, onResetFilter }: LedgerEmptyProps) {
  const { t } = useLanguage()
  return (
    <div className="ledger-empty-wrap flex-1 flex flex-col items-center justify-center my-auto min-h-[320px] py-8">
      <EmptyState
        icon={<BookOpen size={24} aria-hidden="true" />}
        title={t.ledgerEmptyTitle}
        description={t.ledgerEmptyBody}
        action={
          isFiltered && onResetFilter ? (
            <Button variant="outline" size="sm" onClick={onResetFilter}>
              <RotateCcw size={14} aria-hidden="true" />
              <span>{t.viewAll}</span>
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

