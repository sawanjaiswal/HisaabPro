/** Cash Register — Page-level calculator state hook */

import { useReducer, useMemo, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { expressionReducer, EXPRESSION_INITIAL } from './cashRegister.reducer'
import { safeEvaluate } from './cashRegister.evaluator'
import { useCreateCashEntry } from './useCashRegisterMutations'
import { useCashSummary } from './useCashRegisterQueries'
import { getTzOffsetMinutes } from './cashRegister.utils'
import { LARGE_AMOUNT_PAISE } from './cashRegister.constants'
import type { ExpressionAction, CashSummaryDTO, ExpressionError } from './cashRegister.types'

type CommitDirection = 'IN' | 'OUT'

interface UseCashCalculatorReturn {
  expression: string
  liveTotalPaise: number | null
  evalError: ExpressionError | null
  isLargeAmount: boolean
  note: string
  setNote: (n: string) => void
  dispatch: (action: ExpressionAction) => void
  commit: (direction: CommitDirection) => Promise<void>
  isSubmitting: boolean
  summary: CashSummaryDTO | undefined
  summaryLoading: boolean
}

export function useCashCalculator(): UseCashCalculatorReturn {
  const { user } = useAuth()
  const toast = useToast()
  const businessId = user?.businessId ?? ''
  const tzOffsetMinutes = useMemo(() => getTzOffsetMinutes(), [])

  const [exprState, dispatch] = useReducer(expressionReducer, EXPRESSION_INITIAL)
  const [note, setNote] = useState('')

  const createMutation = useCreateCashEntry(businessId)
  const summaryQuery = useCashSummary(businessId, tzOffsetMinutes)

  // Live evaluation — memoised on expression string
  const evalResult = useMemo(
    () => safeEvaluate(exprState.display),
    [exprState.display],
  )

  const liveTotalPaise = evalResult.paise
  const evalError = evalResult.error
  const isLargeAmount = liveTotalPaise !== null && liveTotalPaise > LARGE_AMOUNT_PAISE

  const commit = useCallback(
    async (direction: CommitDirection) => {
      if (!liveTotalPaise || evalError !== null) return
      if (!businessId) return

      const idempotencyKey = await buildIdempotencyKey(businessId, exprState.display, direction)

      try {
        await createMutation.mutateAsync({
          businessId,
          direction,
          amountPaise: liveTotalPaise,
          expression: exprState.display,
          note: note.trim() || null,
          idempotencyKey,
        })

        // Fire haptics on success (graceful no-op on web)
        void triggerHaptic()

        const label = direction === 'IN' ? 'Cash In saved' : 'Cash Out saved'
        toast.success(label)

        // Clear expression + note after successful commit
        dispatch({ type: 'CLEAR' })
        setNote('')
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Could not save. Try again.'
        toast.error(msg)
      }
    },
    [liveTotalPaise, evalError, businessId, exprState.display, note, createMutation, toast],
  )

  return {
    expression: exprState.display,
    liveTotalPaise,
    evalError: evalError,
    isLargeAmount,
    note,
    setNote,
    dispatch,
    commit,
    isSubmitting: createMutation.isPending,
    summary: summaryQuery.data,
    summaryLoading: summaryQuery.isLoading,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildIdempotencyKey(
  businessId: string,
  expression: string,
  direction: string,
): Promise<string> {
  const nonce = crypto.randomUUID()
  const material = `${businessId}|${expression}|${direction}|${nonce}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function triggerHaptic(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-assignment
    const mod = await (Function('return import("@capacitor/haptics")')() as Promise<unknown>).catch(() => null)
    if (mod && typeof mod === 'object' && mod !== null) {
      const m = mod as Record<string, unknown>
      if (typeof m['Haptics'] === 'object' && m['Haptics'] !== null) {
        const haptics = m['Haptics'] as { impact: (opts: unknown) => Promise<void> }
        const style = (m['ImpactStyle'] as Record<string, string>)?.['Medium'] ?? 'MEDIUM'
        await haptics.impact({ style })
      }
    }
  } catch {
    // Haptic unavailable on web or old devices — graceful no-op
  }
}
