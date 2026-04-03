/** Invoice Templates — List hook
 *
 * PRD: invoice-templates-PLAN.md
 */

import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: ({ signal }) => getTemplates(signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      const message = err instanceof ApiError ? err.message : 'Failed to load templates'
      toast.error(message)
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.templates.all() })
  }, [queryClient])

  return {
    templates: query.data ?? [],
    status,
    refresh,
  }
}
