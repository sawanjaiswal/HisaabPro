/**
 * Phase 7 · 7.1D PR-D3 — Payment mode enum guard (M9, defense in depth).
 *
 * The normalizer (`payment-mode-map.ts`) is the SSOT for raw → enum
 * resolution. By the time a row reaches this guard the `mode` SHOULD
 * already be a member of `PAYMENT_MODES`. But: a hand-crafted
 * `normalized.mode` slipped in via a CREATE_NEW dedup resolution, a
 * future test fixture, or a misconfigured upstream service would
 * otherwise reach Prisma raw — and Prisma's stack trace echoes the
 * offending value. That's a PII leak (S9) AND a 500-with-data response.
 *
 * Guard runs BEFORE every `tx.payment.create` call. Fail-fast with a
 * PII-clean AppError (the value is summarised, not echoed).
 *
 * Authority:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1 M9 (pre-insert enum guard)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §6 (allocate-one ladder step 2)
 */

import { AppError, ErrorCode } from '../../../lib/errors.js'
import {
  PAYMENT_MODES,
  type PaymentMode,
} from '../normalizers/payment-mode-map.constants.js'

const VALID_MODES: ReadonlySet<string> = new Set<string>(PAYMENT_MODES)

/**
 * Throws `PAYMENT_MODE_INVALID` (422) if `mode` is not a member of
 * `PAYMENT_MODES`. PII-safe: the offending value is replaced by its
 * `typeof` summary in the error payload so audit / logs cannot leak it.
 */
export function assertPaymentMode(mode: unknown): asserts mode is PaymentMode {
  if (typeof mode === 'string' && VALID_MODES.has(mode)) return
  throw new AppError(
    ErrorCode.PAYMENT_MODE_INVALID,
    422,
    'paymentMode is not a recognised PaymentMode enum member',
    {
      // S9 — do NOT echo the raw value; only its shape.
      receivedType: typeof mode,
    },
  )
}
