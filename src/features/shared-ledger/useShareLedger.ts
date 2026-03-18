/** Share Ledger — Hook for managing ledger shares */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { createLedgerShare, listLedgerShares, revokeLedgerShare } from './shared-ledger.service'
import { buildShareUrl, copyToClipboard } from './shared-ledger.utils'
import type { LedgerShare, CreateLedgerShareData } from './shared-ledger.types'

export function useShareLedger(partyId: string) {
  const toast = useToast()
  const [shares, setShares] = useState<LedgerShare[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Load existing shares
  const loadShares = useCallback(async () => {
    setIsLoading(true)
    abortRef.current = new AbortController()
    try {
      const data = await listLedgerShares(partyId, abortRef.current.signal)
      setShares(data)
    } catch {
      // API not available yet — silent fail
    } finally {
      setIsLoading(false)
    }
  }, [partyId])

  useEffect(() => {
    loadShares()
    return () => { abortRef.current?.abort() }
  }, [loadShares])

  // Create share
  const createShare = useCallback(async (data: CreateLedgerShareData) => {
    setIsCreating(true)
    try {
      const share = await createLedgerShare(partyId, data)
      setShares((prev) => [share, ...prev])
      const url = buildShareUrl(share.shareToken)
      await copyToClipboard(url)
      toast.success('Share link copied!')
      return share
    } catch {
      toast.error('Failed to create share link')
      return null
    } finally {
      setIsCreating(false)
    }
  }, [partyId, toast])

  // Revoke share
  const revokeShare = useCallback(async (shareId: string) => {
    try {
      await revokeLedgerShare(partyId, shareId)
      setShares((prev) => prev.filter((s) => s.id !== shareId))
      toast.success('Share link revoked')
    } catch {
      toast.error('Failed to revoke share link')
    }
  }, [partyId, toast])

  // Copy link
  const copyLink = useCallback(async (share: LedgerShare) => {
    const url = buildShareUrl(share.shareToken)
    const ok = await copyToClipboard(url)
    if (ok) toast.success('Link copied!')
    else toast.error('Failed to copy')
  }, [toast])

  return { shares, isLoading, isCreating, createShare, revokeShare, copyLink, refresh: loadShares }
}
