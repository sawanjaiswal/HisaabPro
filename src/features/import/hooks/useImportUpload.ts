/**
 * Phase 7 Slice 7.1A — Upload hook.
 * Wraps the upload service in a TanStack mutation and exposes a single
 * `submit()` that returns the BE's CreateImportRes. The caller decides
 * what to do with the job (navigate to detail, etc.).
 */

import { useMutation } from '@tanstack/react-query'
import { uploadImport } from '../services/import.service'
import type {
  CreateImportRes,
  ImportEntity,
  ImportFormat,
} from '../types/import.types'

export interface UseImportUploadArgs {
  onSuccess?: (res: CreateImportRes) => void
  onError?: (err: unknown) => void
}

export interface SubmitArgs {
  file: File
  format: ImportFormat
  /** 7.1B: entity discriminator. Defaults to 'parties'. */
  entity?: ImportEntity
  columnMapping?: Record<string, string>
}

/** Generate a fresh idempotency key per submit attempt. */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function useImportUpload(args: UseImportUploadArgs = {}) {
  const mutation = useMutation({
    mutationFn: (vars: SubmitArgs) =>
      uploadImport({
        file: vars.file,
        format: vars.format,
        entity: vars.entity,
        columnMapping: vars.columnMapping,
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: (res) => {
      args.onSuccess?.(res)
    },
    onError: (err) => {
      args.onError?.(err)
    },
  })

  return {
    submit: mutation.mutate,
    submitAsync: mutation.mutateAsync,
    isUploading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  }
}
