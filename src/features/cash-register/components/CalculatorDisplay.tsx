/** Cash Register — Calculator display: expression + live total + error chip */

import type { ExpressionError } from '../cashRegister.types'
import { formatPaise } from '../cashRegister.utils'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  expression: string
  liveTotalPaise: number | null
  evalError: ExpressionError | null
  isLargeAmount?: boolean
}

export function CalculatorDisplay({ expression, liveTotalPaise, evalError, isLargeAmount }: Props) {
  const { t } = useLanguage()
  const ERROR_LABELS: Record<ExpressionError, string> = {
    EMPTY:           '',
    TOO_LONG:        t.cashRegErrorTooLong,
    INVALID_CHAR:    t.cashRegErrorInvalidChar,
    SYNTAX_ERROR:    t.cashRegErrorInvalidExpression,
    DIVIDE_BY_ZERO:  t.cashRegErrorDivideByZero,
    INVALID_RESULT:  t.cashRegErrorInvalidResult,
    RESULT_OVERFLOW: t.cashRegErrorOverflow,
  }
  const hasExpression = expression.length > 0
  const showTotal = liveTotalPaise !== null && evalError === null
  const showError = hasExpression && evalError !== null && evalError !== 'EMPTY'
  const showWarning = isLargeAmount && !evalError

  return (
    <div className="cr-display" role="region" aria-label={t.cashRegDisplayAria}>
      {/* Expression line */}
      <div className="cr-display__expr" aria-live="polite">
        {hasExpression ? (
          <span className="cr-display__expr-text">{expression}</span>
        ) : (
          <span className="cr-display__placeholder">{t.cashRegPlaceholderEnterAmount}</span>
        )}
      </div>

      {/* Live total */}
      {showTotal && (
        <div className="cr-display__total" aria-live="polite">
          = {formatPaise(liveTotalPaise)}
        </div>
      )}

      {/* Error chip */}
      {showError && (
        <div className="cr-display__chip cr-display__chip--error" role="alert">
          {ERROR_LABELS[evalError!] ?? t.cashRegErrorInvalidExpression}
        </div>
      )}

      {/* Large-amount warning */}
      {showWarning && (
        <div className="cr-display__chip cr-display__chip--warning">
          {t.cashRegErrorAmountHigh}
        </div>
      )}
    </div>
  )
}
