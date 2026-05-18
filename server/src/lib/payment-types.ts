/**
 * SERVER-SIDE PAYMENT-TYPE HELPERS — houses the AppError-throwing assert.
 *
 * The pure FE+BE-safe helpers (`paymentTypeDirection`, `isCustomerPaymentType`,
 * `isPayrollPaymentType`) live in `shared/payment-types.ts` so the FE bundle
 * can use them without dragging server-only AppError/Logger into the bundle.
 *
 * `assertCustomerPaymentType` lives HERE because it throws `AppError(...)` from
 * `server/src/lib/errors.ts` — a server-only dependency. Both layers compose
 * into the M8 single-rejection-path: Zod (PaymentTypePublic) is the first
 * defense, this assert is the second; both fail identically with 400
 * INVALID_PAYMENT_TYPE per architecture §2.2.
 *
 * Architecture reference: ARCHITECTURE_PHASE6_STAFF_HR §2.2 (M8 closure v2.2).
 */

import { isCustomerPaymentType } from '../../../shared/payment-types.js'
import type { CustomerPaymentType, PaymentType } from '../../../shared/enums.js'
import { AppError, ErrorCode } from './errors.js'

// Re-export the pure helpers so server-side consumers can grab everything from
// one path; this keeps the consumer-side import sites short and matches the
// "single source of truth for server-side payment-type semantics" intent.
export {
  isCustomerPaymentType,
  isPayrollPaymentType,
  paymentTypeDirection,
} from '../../../shared/payment-types.js'

/**
 * Throws `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)` if the type is
 * not a customer-payment type (i.e. is one of PAYROLL_OUT / PAYROLL_IN).
 *
 * Used as defense-in-depth at the top of every customer-payment-create code
 * path AND at the top of every customer-ledger code path. The single
 * rejection semantic means the acceptance test at §17.2 reliably observes
 * 400 INVALID_PAYMENT_TYPE regardless of which guard (Zod, assert) fires
 * first — both paths produce the same status code, code, and message shape
 * through `errorHandler.ts`'s AppError → typed JSON response mapping.
 */
export function assertCustomerPaymentType(
  type: PaymentType,
): asserts type is CustomerPaymentType {
  if (!isCustomerPaymentType(type)) {
    throw new AppError(
      ErrorCode.INVALID_PAYMENT_TYPE,
      400,
      'Payroll payment types (PAYROLL_OUT, PAYROLL_IN) cannot be created via the public payments endpoint',
      { type },
    )
  }
}
