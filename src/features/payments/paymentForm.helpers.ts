/** Payment Form — Pure helper functions
 *
 * Extracts pure logic from usePaymentForm: initial state building,
 * API payload construction, allocation merging. No React, no hooks.
 * All amounts in PAISE.
 */

import { toLocalISODate } from '@/lib/format'
import type {
  PaymentType,
  PaymentMode,
  PaymentFormData,
  PaymentFormAllocation,
  PaymentDetail,
} from './payment.types'
import { autoAllocateFIFO } from './payment.utils'

// ─── Initial form state ────────────────────────────────────────────────────────

export function buildInitialForm(type: PaymentType): PaymentFormData {
  return {
    type,
    partyId: '',
    amount: 0,
    date: toLocalISODate(new Date()),
    mode: 'CASH',
    referenceNumber: '',
    notes: '',
    allocations: [],
    discount: null,
  }
}

/** Pre-populate form state from an existing PaymentDetail (edit mode). */
export function buildFormFromPayment(payment: PaymentDetail): PaymentFormData {
  return {
    type: payment.type,
    partyId: payment.partyId,
    amount: payment.amount,
    date: payment.date,
    mode: payment.mode,
    referenceNumber: payment.referenceNumber ?? '',
    notes: payment.notes ?? '',
    allocations: payment.allocations.map((a) => ({
      invoiceId: a.invoiceId,
      invoiceNumber: a.invoiceNumber,
      // In edit mode we don't know invoiceDue from the allocation shape alone;
      // components should enrich this from the outstanding API if needed.
      invoiceDue: a.amount,
      amount: a.amount,
      selected: true,
    })),
    discount: payment.discount !== null
      ? {
          type: payment.discount.type,
          value: payment.discount.value,
          calculatedAmount: payment.discount.calculatedAmount,
          reason: payment.discount.reason ?? '',
        }
      : null,
  }
}

// ─── Allocation merge (used by autoAllocate) ─────────────────────────────────

/**
 * Run FIFO allocation on the selected invoices and merge results back
 * into the full allocations array (preserving original order).
 */
export function mergeAutoAllocated(
  allocations: PaymentFormAllocation[],
  paymentAmount: number,
): PaymentFormAllocation[] {
  const selected = allocations.filter((a) => a.selected)
  const unselected = allocations.filter((a) => !a.selected)
  const allocated = autoAllocateFIFO(paymentAmount, selected)

  return allocations.map((a) => {
    const found = allocated.find((x) => x.invoiceId === a.invoiceId)
    const unsel = unselected.find((x) => x.invoiceId === a.invoiceId)
    return found ?? unsel ?? a
  })
}

// ─── API payload builder ──────────────────────────────────────────────────────

interface ApiAllocation {
  invoiceId: string
  amount: number
}

interface ApiDiscount {
  type: string
  value: number
  reason: string | undefined
}

export interface PaymentApiPayload {
  type: PaymentType
  partyId: string
  amount: number
  date: string
  mode: PaymentMode
  referenceNumber: string | undefined
  notes: string | undefined
  allocations: ApiAllocation[]
  discount: ApiDiscount | undefined
}

/**
 * Build the API payload from form data + selected allocations.
 * Strips client-only fields and trims optional strings.
 */
export function buildApiPayload(
  form: PaymentFormData,
  selectedAllocations: PaymentFormAllocation[],
): PaymentApiPayload {
  const apiAllocations = selectedAllocations.map(({ invoiceId, amount }) => ({
    invoiceId,
    amount,
  }))

  return {
    type: form.type,
    partyId: form.partyId,
    amount: form.amount,
    date: form.date,
    mode: form.mode,
    referenceNumber: form.referenceNumber.trim() || undefined,
    notes: form.notes.trim() || undefined,
    allocations: apiAllocations,
    discount: form.discount !== null && form.discount.value > 0
      ? {
          type: form.discount.type,
          value: form.discount.value,
          reason: form.discount.reason.trim() || undefined,
        }
      : undefined,
  }
}
