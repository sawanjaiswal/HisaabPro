/** Cash Register — Cash In / Cash Out commit buttons */

import { Loader2 } from 'lucide-react'
import type { ExpressionError } from '../cashRegister.types'
import { Button } from '@/components/ui/Button'

interface Props {
  onCommit: (direction: 'IN' | 'OUT') => void
  isSubmitting: boolean
  isDisabled: boolean
  evalError: ExpressionError | null
  liveTotalPaise: number | null
}

export function CommitButtons({ onCommit, isSubmitting, isDisabled, evalError, liveTotalPaise }: Props) {
  const canCommit = liveTotalPaise !== null && evalError === null && !isSubmitting
  const disabled = !canCommit || isDisabled

  return (
    <div className="cr-commit" role="group" aria-label="Commit cash entry">
      <Button variant="none"
        type="button"
        className="cr-commit__btn cr-commit__btn--in"
        onClick={() => onCommit('IN')}
        disabled={disabled}
        aria-busy={isSubmitting}
        aria-label={isSubmitting ? 'Saving...' : 'Cash In'}
      >
        {isSubmitting ? (
          <Loader2 size={18} className="cr-commit__spinner" aria-hidden="true" />
        ) : null}
        <span>Cash In</span>
      </Button>

      <Button variant="none"
        type="button"
        className="cr-commit__btn cr-commit__btn--out"
        onClick={() => onCommit('OUT')}
        disabled={disabled}
        aria-busy={isSubmitting}
        aria-label={isSubmitting ? 'Saving...' : 'Cash Out'}
      >
        {isSubmitting ? (
          <Loader2 size={18} className="cr-commit__spinner" aria-hidden="true" />
        ) : null}
        <span>Cash Out</span>
      </Button>
    </div>
  )
}
