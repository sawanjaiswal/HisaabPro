/** #147 useBankReconciliation — orchestrates import, list, and line actions. */
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import {
  createImport,
  listLines,
  confirmLine,
  ignoreLine,
  unreconcileLine,
} from '../bank-reconciliation.service'
import type { CreateImportInput, ReconTab } from '../bank-reconciliation.types'

type Status = 'loading' | 'error' | 'success'

const linesKey = (tab: ReconTab, accountId: string | null) =>
  ['bank-reconciliation', 'lines', tab, accountId] as const

export function useBankReconciliation() {
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<ReconTab>('SUGGESTED')
  const [accountId, setAccountId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: linesKey(tab, accountId),
    queryFn: ({ signal }) => listLines(tab, accountId, null, signal),
  })

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bank-reconciliation', 'lines'] })
  }, [queryClient])

  const importMutation = useMutation({
    mutationFn: (input: CreateImportInput) => createImport(input),
    onSuccess: (result) => {
      invalidateAll()
      toast.success(`${result.lines.length} ${t.bankReconImported}`)
      if (result.poolTruncated) toast.error(t.bankReconPoolTruncated)
      if (result.duplicateCount > 0) {
        toast.error(`${result.duplicateCount} ${t.bankReconDuplicateWarn}`)
      }
      setTab('SUGGESTED')
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t.bankReconActionFailed)
    },
  })

  function lineAction(fn: (id: string) => Promise<unknown>, successMsg: string) {
    return async (lineId: string) => {
      try {
        await fn(lineId)
        invalidateAll()
        toast.success(successMsg)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t.bankReconActionFailed)
      }
    }
  }

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    tab,
    setTab,
    accountId,
    setAccountId,
    lines: query.data?.lines ?? [],
    status,
    refresh: () => query.refetch(),
    importStatement: importMutation.mutate,
    isImporting: importMutation.isPending,
    confirm: lineAction(confirmLine, t.bankReconConfirmed),
    ignore: lineAction(ignoreLine, t.bankReconIgnored),
    unreconcile: lineAction(unreconcileLine, t.bankReconUnreconciled),
  }
}
