/**
 * SHARED PAYMENT-TYPE HELPERS — pure functions, FE+BE safe.
 *
 * The AppError-throwing assert (`assertCustomerPaymentType`) lives in the
 * server-only twin at `server/src/lib/payment-types.ts`. Splitting the helpers
 * across two files keeps this module free of server-only imports so the FE
 * bundle (which imports `@shared/enums`) can also pull in these helpers
 * without dragging the server's logger/Prisma chain into the bundle.
 *
 * Architecture reference: ARCHITECTURE_PHASE6_STAFF_HR §2.2 (M6/M8 closures).
 */

import {
  CUSTOMER_PAYMENT_TYPES,
  type CustomerPaymentType,
  type PaymentType,
} from './enums.js'

/**
 * Arithmetic direction of a Payment row's effect on a customer/supplier
 * outstanding balance.
 *
 *  +1 → PAYMENT_OUT (money out — increases payable to supplier)
 *  -1 → PAYMENT_IN  (money in — decreases receivable from customer)
 *   0 → PAYROLL_OUT / PAYROLL_IN (never touch customer balance — they hit STAFF
 *       Party only; customer-ledger queries filter `party.type != 'STAFF'`)
 *
 * The `default: never` branch fails the TypeScript build if a new PaymentType
 * value is added to `shared/enums.ts` without updating this helper — the
 * intentional canary documented in §2.2 (M6 closure).
 */
export function paymentTypeDirection(type: PaymentType): -1 | 0 | 1 {
  switch (type) {
    case 'PAYMENT_IN':
      return -1
    case 'PAYMENT_OUT':
      return 1
    case 'PAYROLL_OUT':
      return 0
    case 'PAYROLL_IN':
      return 0
    default: {
      const _exhaustive: never = type
      throw new Error(`Unknown Payment.type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/** Type guard — narrows `string` (or any PaymentType) to CustomerPaymentType. */
export function isCustomerPaymentType(type: string): type is CustomerPaymentType {
  return (CUSTOMER_PAYMENT_TYPES as readonly string[]).includes(type)
}

/** True iff the type is one of the payroll-only values (PAYROLL_OUT, PAYROLL_IN). */
export function isPayrollPaymentType(type: string): boolean {
  return type === 'PAYROLL_OUT' || type === 'PAYROLL_IN'
}
