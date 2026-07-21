/**
 * The single error type every `api()` failure surfaces.
 *
 * Lives in its own module so request/response helpers can throw it without
 * importing `api.ts` (which imports them — that would be a cycle).
 * Re-exported from `@/lib/api`, which is where callers should import it from.
 */
export class ApiError extends Error {
  public detail?: unknown // e.g. INSUFFICIENT_STOCK items array
  constructor(message: string, public code: string, public status: number, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.detail = detail
  }
}
