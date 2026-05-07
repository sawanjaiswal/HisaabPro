/** POS — Single sale query + void/restore mutations */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { getSale, voidSale, restoreSale } from '../api/pos.service'
import { POS_SALES_KEY } from './usePosHistory'
import type { PosSaleDTO } from '../types/pos.types'

const POS_SALE_DETAIL_KEY = 'pos-sale-detail'

export function usePosSaleDetail(id: string | undefined) {
  const toast = useToast()
  const { t } = useLanguage()
  const qc    = useQueryClient()

  const query = useQuery({
    queryKey: [POS_SALE_DETAIL_KEY, id],
    queryFn:  () => getSale(id!),
    enabled:  !!id,
    staleTime: 0,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [POS_SALE_DETAIL_KEY, id] })
    void qc.invalidateQueries({ queryKey: [POS_SALES_KEY] })
  }

  const voidMutation = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      voidSale(id!, reason, query.data?.receiptNumber ?? id!),
    onSuccess: (updated) => {
      qc.setQueryData([POS_SALE_DETAIL_KEY, id], updated)
      invalidate()
      toast.success(t.posVoidSuccess ?? 'Sale voided')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : (t.posVoidFailed ?? 'Could not void sale'))
    },
  })

  const restoreMutation = useMutation({
    mutationFn: () =>
      restoreSale(id!, query.data?.receiptNumber ?? id!),
    onSuccess: (updated) => {
      qc.setQueryData([POS_SALE_DETAIL_KEY, id], updated)
      invalidate()
      toast.success(t.posRestoreSuccess ?? 'Sale restored')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : (t.posRestoreFailed ?? 'Could not restore sale'))
    },
  })

  const sale: PosSaleDTO | undefined = query.data

  /** True if sale is within 24h void window */
  const canVoid = (() => {
    if (!sale || sale.status === 'VOIDED') return false
    const created = new Date(sale.createdAt).getTime()
    const now     = Date.now()
    return now - created < 24 * 60 * 60 * 1000
  })()

  const canRestore = sale?.status === 'VOIDED'

  return {
    sale,
    isLoading:    query.isLoading,
    isError:      query.isError,
    refetch:      () => { void query.refetch() },
    canVoid,
    canRestore,
    isVoiding:    voidMutation.isPending,
    isRestoring:  restoreMutation.isPending,
    doVoid:       (reason: string) => voidMutation.mutate({ reason }),
    doRestore:    () => restoreMutation.mutate(),
  }
}
