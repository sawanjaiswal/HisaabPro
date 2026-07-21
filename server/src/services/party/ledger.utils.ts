/**
 * Party ledger — pure helpers (date windows, voucher mapping, row merging).
 *
 * Split out of `ledger.service.ts` so that file holds query orchestration only.
 * Everything here is a pure transform over plain objects: no Prisma, no I/O.
 * All amounts are PAISE integers — `Number()` is applied at the boundary
 * because Prisma returns Decimal/BigInt for money columns, never float math.
 */

import { paymentTypeDirection } from '../../lib/payment-types.js'
import type { PaymentType } from '../../../../shared/enums.js'
import type { LedgerVoucherType } from './ledger.types.js'

/** Document types → ledger voucher type + sign (DR positive, CR negative). */
export const DOC_VOUCHER_MAP: Record<string, { voucherType: LedgerVoucherType; sign: 1 | -1 }> = {
  SALE_INVOICE: { voucherType: 'SALE', sign: 1 },
  POS_SALE:     { voucherType: 'SALE', sign: 1 },
  ESTIMATE:     { voucherType: 'SALE', sign: 1 },
  SALE_ORDER:   { voucherType: 'SALE', sign: 1 },
  DELIVERY_CHALLAN: { voucherType: 'SALE', sign: 1 },
  PURCHASE_INVOICE: { voucherType: 'PURCHASE', sign: -1 },
  CREDIT_NOTE:  { voucherType: 'CN', sign: -1 },
  DEBIT_NOTE:   { voucherType: 'DN', sign: 1 },
}

export function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`)
}

/** Voucher-type filter → document types array. `undefined` = no filter. */
export function docTypesForFilter(voucherTypes?: LedgerVoucherType[]): string[] | undefined {
  if (!voucherTypes?.length) return undefined
  const result: string[] = []
  for (const vt of voucherTypes) {
    if (vt === 'SALE') result.push('SALE_INVOICE', 'POS_SALE', 'ESTIMATE', 'SALE_ORDER', 'DELIVERY_CHALLAN')
    if (vt === 'PURCHASE') result.push('PURCHASE_INVOICE')
    if (vt === 'CN') result.push('CREDIT_NOTE')
    if (vt === 'DN') result.push('DEBIT_NOTE')
  }
  return result.length > 0 ? result : undefined
}

/** Unified pre-render ledger row, before the running balance is applied. */
export interface RawRow {
  id: string
  source: 'DOCUMENT' | 'PAYMENT' | 'JOURNAL'
  date: Date
  createdAt: Date
  voucherType: LedgerVoucherType
  voucherNumber: string
  particulars: string
  dr: number
  cr: number
  itemCount?: number
  mode?: string
}

/** Minimal shapes the mappers need — structural, so Prisma selects satisfy them. */
export interface DocRowInput {
  id: string
  type: string
  grandTotal: unknown
  documentDate: Date
  documentNumber: string | null
  createdAt: Date
  party: { name: string }
  _count?: { lineItems: number }
}
export interface PayRowInput {
  id: string
  type: string
  amount: unknown
  date: Date
  referenceNumber: string | null
  mode: string
  createdAt: Date
}
export interface JeRowInput {
  id: string
  debit: unknown
  credit: unknown
  narration: string | null
  createdAt: Date
  journalEntry: { date: Date; entryNumber: string; narration: string | null }
}

/**
 * Opening balance — every transaction strictly before the window start.
 *
 * Journal lines exclude auto-posted DOCUMENT/PAYMENT mirrors at the query
 * layer; if they were included here each sale would count twice.
 */
export function computeOpeningBalance(
  docs: { type: string; grandTotal: unknown }[],
  pays: { type: string; amount: unknown }[],
  jeLines: { debit: unknown; credit: unknown }[],
): number {
  let opening = 0
  for (const d of docs) {
    const mapping = DOC_VOUCHER_MAP[d.type]
    if (mapping) opening += mapping.sign * Number(d.grandTotal)
  }
  for (const p of pays) {
    // paymentTypeDirection mirrors customer-outstanding sign (M6 v2.1); PAYROLL_*=0.
    opening += paymentTypeDirection(p.type as PaymentType) * Number(p.amount)
  }
  for (const j of jeLines) {
    opening += Number(j.debit) - Number(j.credit)
  }
  return opening
}

/** Map the three query result sets into one merged, chronologically sorted list. */
export function mergeLedgerRows(
  docs: DocRowInput[],
  pays: PayRowInput[],
  jeLines: JeRowInput[],
): RawRow[] {
  const rows: RawRow[] = []

  for (const d of docs) {
    const mapping = DOC_VOUCHER_MAP[d.type]
    if (!mapping) continue
    const amount = Number(d.grandTotal)
    rows.push({
      id: d.id, source: 'DOCUMENT',
      date: d.documentDate, createdAt: d.createdAt,
      voucherType: mapping.voucherType,
      voucherNumber: d.documentNumber ?? '',
      particulars: `${d.type.replace(/_/g, ' ')} — ${d.party.name}`,
      dr: mapping.sign > 0 ? amount : 0,
      cr: mapping.sign < 0 ? amount : 0,
      itemCount: d._count?.lineItems,
    })
  }

  for (const p of pays) {
    const isIn = p.type === 'PAYMENT_IN'
    rows.push({
      id: p.id, source: 'PAYMENT',
      date: p.date, createdAt: p.createdAt,
      voucherType: 'PAYMENT',
      voucherNumber: p.referenceNumber ?? '',
      particulars: isIn ? 'Payment received' : 'Payment made',
      dr: isIn ? 0 : Number(p.amount),
      cr: isIn ? Number(p.amount) : 0,
      mode: p.mode,
    })
  }

  for (const j of jeLines) {
    rows.push({
      id: j.id, source: 'JOURNAL',
      date: j.journalEntry.date, createdAt: j.createdAt,
      voucherType: 'JE',
      voucherNumber: j.journalEntry.entryNumber,
      particulars: j.narration ?? j.journalEntry.narration ?? 'Journal Entry',
      dr: Number(j.debit),
      cr: Number(j.credit),
    })
  }

  // Date first, then insertion order — two vouchers on the same day must keep
  // a stable order or the running balance would jitter between requests.
  rows.sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime()
    if (d !== 0) return d
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  return rows
}
