/** Cash Register — Edit entry bottom drawer */

import { useState, useReducer, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { useEditCashEntry } from '../useCashRegisterMutations'
import { CalculatorDisplay } from './CalculatorDisplay'
import { Keypad } from './Keypad'
import { NoteField } from './NoteField'
import { expressionReducer, EXPRESSION_INITIAL } from '../cashRegister.reducer'
import { safeEvaluate } from '../cashRegister.evaluator'
import type { CashEntryDTO } from '../cashRegister.types'
import { Button } from '@/components/ui/Button'

interface Props {
  entry: CashEntryDTO
  businessId: string
  onClose: () => void
}

export function EditEntryDrawer({ entry, businessId, onClose }: Props) {
  const toast = useToast()
  const editMutation = useEditCashEntry(businessId)

  // Pre-fill expression from existing entry
  const [exprState, dispatch] = useReducer(expressionReducer, {
    ...EXPRESSION_INITIAL,
    display: entry.expression,
  })
  const [note, setNote] = useState(entry.note ?? '')

  const evalResult = useMemo(() => safeEvaluate(exprState.display), [exprState.display])

  const canSave =
    evalResult.paise !== null &&
    evalResult.error === null &&
    !editMutation.isPending

  const handleSave = async () => {
    if (!canSave || evalResult.paise === null) return

    const idempotencyKey = await buildKey(entry.id)
    try {
      await editMutation.mutateAsync({
        businessId,
        id: entry.id,
        patch: {
          amountPaise: evalResult.paise,
          expression: exprState.display,
          note: note.trim() || null,
        },
        idempotencyKey,
      })
      toast.success('Entry updated')
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save. Try again.')
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit Entry"
      size="md"
      footer={
        <Button variant="none"
          type="button"
          className="cr-edit-drawer__save btn btn-primary btn-lg"
          onClick={() => void handleSave()}
          disabled={!canSave}
          aria-busy={editMutation.isPending}
        >
          {editMutation.isPending
            ? <><Loader2 size={16} className="spinner" aria-hidden="true" /> Saving…</>
            : 'Save Changes'
          }
        </Button>
      }
    >
      <CalculatorDisplay
        expression={exprState.display}
        liveTotalPaise={evalResult.paise}
        evalError={evalResult.error}
      />
      <Keypad onKey={dispatch} disabled={editMutation.isPending} />
      <NoteField value={note} onChange={setNote} disabled={editMutation.isPending} />
    </Drawer>
  )
}

async function buildKey(entryId: string): Promise<string> {
  const material = `edit|${entryId}|${crypto.randomUUID()}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
