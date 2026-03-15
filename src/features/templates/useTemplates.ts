/** Invoice Templates — List hook
 *
 * Mirrors useProducts.ts pattern. Manages the full list of template summaries,
 * AbortController cleanup on unmount, and manual refresh via refreshKey.
 *
 * PRD: invoice-templates-PLAN.md
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getTemplates } from './template.service'
import type { TemplateSummary } from './template.types'

type Status = 'loading' | 'error' | 'success'

interface UseTemplatesReturn {
  templates: TemplateSummary[]
  status: Status
  refresh: () => void
}

export function useTemplates(): UseTemplatesReturn {
  const toast = useToast()

  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getTemplates(controller.signal)
      .then((data: TemplateSummary[]) => {
        setTemplates(data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load templates'
        toast.error(message)
      })

    return () => controller.abort()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    templates,
    status,
    refresh,
  }
}
