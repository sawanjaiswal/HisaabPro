/** Settings — Document settings hook (TanStack Query + optimistic debounce) */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { getDocumentSettings, updateDocumentSettings } from './document-settings.service'
import type { DocumentSettings } from '@/features/invoices/invoice-api.types'

const DEBOUNCE_MS = 600

const DEFAULT_SETTINGS: Partial<DocumentSettings> = {
  enforceMoq: false,
  showLineItemImages: false,
}

export function useDocumentSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [localSettings, setLocalSettings] = useState<DocumentSettings | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = useQuery({
    queryKey: queryKeys.settings.documents(),
    queryFn: ({ signal }) => getDocumentSettings(signal),
  })

  useEffect(() => {
    if (query.data && localSettings === null) {
      setLocalSettings(query.data)
    }
  }, [query.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const settings = localSettings ?? query.data ?? (DEFAULT_SETTINGS as DocumentSettings)
  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    setLocalSettings(null)
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.documents() })
  }, [queryClient])

  const saveMutation = useMutation({
    mutationFn: (updated: Partial<DocumentSettings>) => updateDocumentSettings(updated),
    onSuccess: (saved) => {
      setLocalSettings(saved)
      queryClient.setQueryData(queryKeys.settings.documents(), saved)
      toast.success('Settings saved')
    },
    onError: () => {
      toast.error('Failed to save document settings')
    },
  })

  const updateField = useCallback(<K extends keyof DocumentSettings>(
    key: K,
    value: DocumentSettings[K],
  ) => {
    setLocalSettings((prev) => {
      const base = prev ?? (DEFAULT_SETTINGS as DocumentSettings)
      const updated = { ...base, [key]: value }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveMutation.mutate({ [key]: value })
      }, DEBOUNCE_MS)

      return updated
    })
  }, [saveMutation])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return { settings, status, refresh, updateField }
}
