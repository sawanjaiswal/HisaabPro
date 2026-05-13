/** Document Custom Fields — TanStack Query hook (#134)
 *
 * Wraps list/create/update/delete; invalidates settings cache + the
 * invoice form's per-doc-type cache so newly added fields show up.
 */

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import {
  listDocumentCustomFields,
  createDocumentCustomField,
  updateDocumentCustomField,
  deleteDocumentCustomField,
  type DocumentCustomFieldDef,
  type CreateDocumentCustomFieldInput,
  type UpdateDocumentCustomFieldInput,
} from './document-custom-fields.service'

type Status = 'loading' | 'error' | 'success'

interface UseDocumentCustomFieldsReturn {
  fields: DocumentCustomFieldDef[]
  status: Status
  refresh: () => void
  create: (data: CreateDocumentCustomFieldInput) => Promise<DocumentCustomFieldDef>
  update: (args: { id: string; data: UpdateDocumentCustomFieldInput }) => Promise<DocumentCustomFieldDef>
  remove: (id: string) => Promise<void>
  isMutating: boolean
}

export function useDocumentCustomFields(): UseDocumentCustomFieldsReturn {
  const toast = useToast()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.settings.documentCustomFields(),
    queryFn: ({ signal }) => listDocumentCustomFields(signal),
  })

  const fields = query.data ?? []
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load custom fields'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.settings.documentCustomFields() })
    qc.invalidateQueries({ queryKey: queryKeys.invoices.all() })
  }

  const createMut = useMutation({
    mutationFn: (data: CreateDocumentCustomFieldInput) => createDocumentCustomField(data),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to create field'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentCustomFieldInput }) =>
      updateDocumentCustomField(id, data),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to update field'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDocumentCustomField(id),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to delete field'),
  })

  return {
    fields,
    status,
    refresh: () => qc.invalidateQueries({ queryKey: queryKeys.settings.documentCustomFields() }),
    create: createMut.mutateAsync,
    update: updateMut.mutateAsync,
    remove: deleteMut.mutateAsync,
    isMutating: createMut.isPending || updateMut.isPending || deleteMut.isPending,
  }
}
