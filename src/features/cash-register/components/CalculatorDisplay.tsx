/** Cash Register — Calculator display: expression + live total + error chip */

import type { ExpressionError } from '../cashRegister.types'
import { formatPaise } from '../cashRegister.utils'

interface Props {
  expression: string
  liveTotalPaise: number | null
  evalError: ExpressionError | null
  isLargeAmount?: boolean
}

const ERROR_LABELS: Record<ExpressionError, string> = {
  EMPTY:          '',
  TOO_LONG:       'Expression too long',
  INVALID_CHAR:   'Invalid character',
  SYNTAX_ERROR:   'Invalid expression',
  DIVIDE_BY_ZERO: 'Cannot divide by zero',
  INVALID_RESULT: 'Amount must be greater than 0',
  RESULT_OVERFLOW: 'Amount exceeds ₹10 crore limit',
}

export function CalculatorDisplay({ expression, liveTotalPaise, evalError, isLargeAmount }: Props) {
  const hasExpression = expression.length > 0
  const showTotal = liveTotalPaise !== null && evalError === null
  const showError = hasExpression && evalError !== null && evalError !== 'EMPTY'
  const showWarning = isLargeAmount && !evalError

  return (
    <div className="cr-display" role="region" aria-label="Calculator display">
      {/* Expression line */}
      <div className="cr-display__expr" aria-live="polite">
        {hasExpression ? (
          <span className="cr-display__expr-text">{expression}</span>
        ) : (
          <span className="cr-display__placeholder">Enter amount</span>
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
          {ERROR_LABELS[evalError!] ?? 'Invalid expression'}
        </div>
      )}

      {/* Large-amount warning */}
      {showWarning && (
        <div className="cr-display__chip cr-display__chip--warning">
          Large amount — please confirm
        </div>
      )}
    </div>
  )
}
