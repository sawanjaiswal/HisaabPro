/** useDocumentShareLinks — TanStack Query hook for document share links
 *
 * Query key: ['shareLinks', documentId]
 * List query + issue mutation + revoke mutation.
 * All mutations invalidate on success.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { listShareLinks, issueShareLink, revokeShareLink } from '../share-links.service'
import type { ShareLinkTtl } from '../share-links.service'

const QUERY_KEY = (documentId: string) => ['shareLinks', documentId] as const

export function useDocumentShareLinks(documentId: string, documentNumber: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  // ── List ──────────────────────────────────────────────────────────────────
  const query = useQuery({
    queryKey: QUERY_KEY(documentId),
    queryFn: () => listShareLinks(documentId),
    enabled: !!documentId,
  })

  // ── Issue ─────────────────────────────────────────────────────────────────
  const issueMutation = useMutation({
    mutationFn: (ttlDays: ShareLinkTtl) =>
      issueShareLink(documentId, documentNumber, ttlDays),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY(documentId) })
    },
    onError: () => {
      toast.error('Failed to generate share link')
    },
  })

  // ── Revoke ────────────────────────────────────────────────────────────────
  const revokeMutation = useMutation({
    mutationFn: (linkId: string) =>
      revokeShareLink(documentId, documentNumber, linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY(documentId) })
      toast.success('Link revoked')
    },
    onError: () => {
      toast.error('Failed to revoke link')
    },
  })

  const activeLinks = (query.data ?? []).filter(
    (l) => !l.revokedAt && (l.expiresAt === null || new Date(l.expiresAt) > new Date())
  )

  return {
    links: query.data ?? [],
    activeLinks,
    isLoading: query.isPending,
    isError: query.isError,
    issue: issueMutation,
    revoke: revokeMutation,
  }
}
