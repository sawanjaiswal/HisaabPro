/**
 * E-Invoice error constants + security helpers.
 * MB-3: sanitizeNicError — strips headers, keeps only ErrorCode+ErrorMsg, max 5, max 1024 chars.
 * MB-4: maskGstin — suffix-4 masking for AuditLog.
 */

// ─── Error codes ─────────────────────────────────────────────────────────────

export const EINVOICE_ERRORS = {
  FIELD_LENGTH: 'EINVOICE_FIELD_LENGTH',
  ALREADY_GENERATED: 'EINVOICE_ALREADY_GENERATED',
  NOT_FOUND: 'EINVOICE_NOT_FOUND',
  CANCEL_WINDOW_EXPIRED: 'EINVOICE_CANCEL_WINDOW_EXPIRED',
  ALREADY_CANCELLED: 'EINVOICE_ALREADY_CANCELLED',
  NIC_AUTH_FAILED: 'EINVOICE_NIC_AUTH_FAILED',
  NIC_SIGNATURE_INVALID: 'EINVOICE_NIC_SIGNATURE_INVALID',
  NIC_CIRCUIT_OPEN: 'EINVOICE_NIC_CIRCUIT_OPEN',
  NIC_TIMEOUT: 'EINVOICE_NIC_TIMEOUT',
  NIC_NOT_CONFIGURED: 'NIC_NOT_CONFIGURED',
  QUOTA_EXCEEDED: 'EINVOICE_QUOTA_EXCEEDED',
  SELLER_GSTIN_MISMATCH: 'EINVOICE_SELLER_GSTIN_MISMATCH',
  DOCUMENT_NOT_ELIGIBLE: 'EINVOICE_DOCUMENT_NOT_ELIGIBLE',
} as const

export type EInvoiceErrorCode = (typeof EINVOICE_ERRORS)[keyof typeof EINVOICE_ERRORS]

// ─── MB-3: NIC error sanitization ────────────────────────────────────────────

interface NicErrorItem {
  ErrorCode?: string | number
  ErrorMsg?: string
  [key: string]: unknown
}

/**
 * Sanitize NIC error response body.
 * Strips Server/X-Powered-By/Stack/Trace-Id, keeps only ErrorCode+ErrorMsg.
 * Max 5 entries, max 1024 chars total.
 */
export function sanitizeNicError(body: unknown): string {
  if (!body) return 'NIC service error'

  try {
    const obj = body as Record<string, unknown>
    const rawErrors: NicErrorItem[] = Array.isArray(obj['errors'])
      ? (obj['errors'] as NicErrorItem[])
      : Array.isArray(obj['ErrorDetails'])
        ? (obj['ErrorDetails'] as NicErrorItem[])
        : []

    if (rawErrors.length === 0) {
      // Try top-level ErrorCode/ErrorMsg
      if (obj['ErrorCode'] || obj['ErrorMsg']) {
        const single = [{ code: obj['ErrorCode'], message: obj['ErrorMsg'] }]
        return JSON.stringify(single).slice(0, 1024)
      }
      return 'NIC service error'
    }

    const sanitized = rawErrors
      .slice(0, 5)
      .map((e) => ({ code: e.ErrorCode, message: e.ErrorMsg }))

    return JSON.stringify(sanitized).slice(0, 1024)
  } catch {
    return 'NIC service error'
  }
}

// ─── MB-4: GSTIN masking ──────────────────────────────────────────────────────

/**
 * Mask GSTIN for AuditLog writes.
 * 29ABCDE1234F1Z5 → XXXXXXXXXXX1Z5 (suffix-4 visible).
 */
export function maskGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  if (gstin.length !== 15) return 'INVALID'
  return 'X'.repeat(11) + gstin.slice(11)
}
