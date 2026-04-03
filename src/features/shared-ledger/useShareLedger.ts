/** Share Ledger -- Hook for managing ledger shares (TanStack Query) */

import { useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { createLedgerShare, listLedgerShares, revokeLedgerShare } from './shared-ledger.service'
import { buildShareUrl, copyToClipboard } from './shared-ledger.utils'
import type { LedgerShare, CreateLedgerShareData } from './shared-ledger.types'

const SHARES_KEY = (partyId: string) => ['shared-ledger', 'shares', partyId] as const

export function useShareLedger(partyId: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SHARES_KEY(partyId),
    queryFn: ({ signal }) => listLedgerShares(partyId, signal),
    enabled: Boolean(partyId),
  })

  // Silent fail on error (API not available yet) -- matches original behavior
  useEffect(() => {
    // no-op: original silently caught errors
  }, [query.isError])

  const createMutation = useMutation({
    mutationFn: (data: CreateLedgerShareData) => createLedgerShare(partyId, data),
    onSuccess: async (share) => {
      queryClient.setQueryData(SHARES_KEY(partyId), (prev: LedgerShare[] | undefined) =>
        prev ? [share, ...prev] : [share],
      )
      const url = buildShareUrl(share.shareToken)
      await copyToClipboard(url)
      toast.success('Share link copied!')
    },
    onError: () => {
      toast.error('Failed to create share link')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) => revokeLedgerShare(partyId, shareId),
    onSuccess: (_data, shareId) => {
      queryClient.setQueryData(SHARES_KEY(partyId), (prev: LedgerShare[] | undefined) =>
        prev ? prev.filter((s) => s.id !== shareId) : [],
      )
      toast.success('Share link revoked')
    },
    onError: () => {
      toast.error('Failed to revoke share link')
    },
  })

  const createShare = useCallback(async (data: CreateLedgerShareData) => {
    try {
      return await createMutation.mutateAsync(data)
    } catch {
      return null
    }
  }, [createMutation])

  const revokeShare = useCallback(async (shareId: string) => {
    revokeMutation.mutate(shareId)
  }, [revokeMutation])

  const copyLink = useCallback(async (share: LedgerShare) => {
    const url = buildShareUrl(share.shareToken)
    const ok = await copyToClipboard(url)
    if (ok) toast.success('Link copied!')
    else toast.error('Failed to copy')
  }, [toast])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: SHARES_KEY(partyId) })
  }

  return {
    shares: query.data ?? [],
    isLoading: query.isPending,
    isCreating: createMutation.isPending,
    createShare,
    revokeShare,
    copyLink,
    refresh,
  }
}
