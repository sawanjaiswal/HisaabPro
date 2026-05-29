/** Ledger — Error state */

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface LedgerErrorProps {
  onRetry: () => void
}

export function LedgerError({ onRetry }: LedgerErrorProps) {
  const { t } = useLanguage()
  return (
    <div className="ledger-error" role="alert">
      <AlertCircle size={32} aria-hidden="true" className="ledger-error__icon" />
      <p className="ledger-error__title">{t.ledgerErrorTitle}</p>
      <p className="ledger-error__body">{t.checkConnectionRetry}</p>
      <Button
        type="button"
        variant="primary" size="sm"
        onClick={onRetry}
        aria-label={t.retry}
      >
        {t.retry}
      </Button>
    </div>
  )
}
