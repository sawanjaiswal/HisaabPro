/** Cash Register — Calculator panel: Display + Keypad + Note + Commit */

import { CalculatorDisplay } from './CalculatorDisplay'
import { Keypad } from './Keypad'
import { NoteField } from './NoteField'
import { CommitButtons } from './CommitButtons'
import type { ExpressionAction, ExpressionError } from '../cashRegister.types'

interface Props {
  expression: string
  liveTotalPaise: number | null
  evalError: ExpressionError | null
  isLargeAmount: boolean
  note: string
  onChangeNote: (v: string) => void
  onKey: (action: ExpressionAction) => void
  onCommit: (direction: 'IN' | 'OUT') => void
  isSubmitting: boolean
  isOffline: boolean
}

export function CalculatorPanel({
  expression,
  liveTotalPaise,
  evalError,
  isLargeAmount,
  note,
  onChangeNote,
  onKey,
  onCommit,
  isSubmitting,
  isOffline,
}: Props) {
  return (
    <div className="cr-calc-panel">
      <CalculatorDisplay
        expression={expression}
        liveTotalPaise={liveTotalPaise}
        evalError={evalError}
        isLargeAmount={isLargeAmount}
      />

      <Keypad onKey={onKey} disabled={isSubmitting} />

      <NoteField
        value={note}
        onChange={onChangeNote}
        disabled={isSubmitting}
      />

      {isOffline && (
        <div className="cr-offline-banner" role="status" aria-live="assertive">
          No internet connection. Please retry.
        </div>
      )}

      <CommitButtons
        onCommit={onCommit}
        isSubmitting={isSubmitting}
        isDisabled={isOffline}
        evalError={evalError}
        liveTotalPaise={liveTotalPaise}
      />
    </div>
  )
}
