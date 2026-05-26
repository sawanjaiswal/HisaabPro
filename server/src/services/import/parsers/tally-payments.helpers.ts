/**
 * Phase 7 · 7.1D PR-D2b — Tally Receipt-voucher helpers (pure).
 *
 * Extracted from `tally-payments.parser.ts` to keep that file under the
 * 250-LOC cap. All functions here are pure — no XML parser dependency,
 * no Buffer / fs access. The parser hands in the already-parsed JS tree
 * and these helpers walk it.
 */

import type { RawPaymentRow } from '../../../types/import.types.js'
import { tallyPreformatDate } from '../normalizers/payment-utils.js'

export interface TallyBillAllocation {
  NAME?: string | { '#text'?: string }
  AMOUNT?: string
}

export interface TallyLedgerEntry {
  LEDGERNAME?: string | { '#text'?: string }
  AMOUNT?: string
  ISDEEMEDPOSITIVE?: string
  'BILLALLOCATIONS.LIST'?: TallyBillAllocation | TallyBillAllocation[]
}

export interface TallyPartyAddrList {
  PARTYMAILINGADDRESS?: string | string[]
}

export interface TallyReceiptVoucher {
  '@_VCHTYPE'?: string
  '@_DATE'?: string
  DATE?: string
  PARTYLEDGERNAME?: string | { '#text'?: string }
  PARTYNAME?: string | { '#text'?: string }
  'PARTYMAILINGADDRESS.LIST'?: TallyPartyAddrList | TallyPartyAddrList[]
  CHEQUENO?: string
  NARRATION?: string
  'ALLLEDGERENTRIES.LIST'?: TallyLedgerEntry | TallyLedgerEntry[]
}

const BANK_OR_CASH_HINTS =
  /\b(bank|cash|hdfc|sbi|icici|axis|kotak|a\/c|account)\b/i

export function asString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return asString(v[0])
  if (typeof v === 'object') {
    const t = (v as { '#text'?: unknown })['#text']
    return t === undefined ? '' : asString(t)
  }
  return ''
}

export function arr<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

export function extractPhone(v: TallyReceiptVoucher): string {
  const lists = arr(v['PARTYMAILINGADDRESS.LIST'])
  for (const list of lists) {
    const addrs = arr(list?.PARTYMAILINGADDRESS)
    for (const a of addrs) {
      const s = asString(a)
      const digits = s.replace(/\D/g, '')
      if (digits.length >= 10) return digits.slice(-10)
    }
  }
  return ''
}

interface BankLeg {
  ledgerName: string
  absAmount: number
}

export function findBankLeg(entries: TallyLedgerEntry[]): BankLeg | null {
  for (const e of entries) {
    const name = asString(e.LEDGERNAME)
    const amt = Number(asString(e.AMOUNT))
    if (!Number.isFinite(amt) || amt === 0) continue
    if (amt < 0 || BANK_OR_CASH_HINTS.test(name)) {
      return { ledgerName: name, absAmount: Math.abs(amt) }
    }
  }
  return null
}

export function extractInvoiceNumber(
  entries: TallyLedgerEntry[],
  raw: Record<string, string>,
): void {
  for (const e of entries) {
    const allocs = arr(e['BILLALLOCATIONS.LIST'])
    if (allocs.length === 0) continue
    const names = allocs
      .map((a) => asString(a.NAME))
      .filter((s) => s.length > 0)
    if (names.length === 0) return
    if (names.length === 1) {
      raw.invoiceNumber = names[0]!
      return
    }
    // Multi-allocation → comma-join; normalizer raises
    // MULTI_ALLOCATION_UNSUPPORTED on the comma.
    raw.invoiceNumber = names.join(',')
    return
  }
}

export function voucherToRow(
  v: TallyReceiptVoucher,
  index: number,
): RawPaymentRow | null {
  const vchType = asString(v['@_VCHTYPE'])
  if (vchType && vchType.toLowerCase() !== 'receipt') return null

  const partyName = asString(v.PARTYLEDGERNAME) || asString(v.PARTYNAME)
  const dateRaw = asString(v['@_DATE']) || asString(v.DATE)
  const preFormatted = tallyPreformatDate(dateRaw)
  // null = invalid calendar → empty string so normalizer emits INVALID_DATE.
  const date = preFormatted ?? ''

  const entries = arr(v['ALLLEDGERENTRIES.LIST'])
  const bank = findBankLeg(entries)

  const raw: Record<string, string> = {}
  if (date) raw.date = date
  if (partyName) raw.partyName = partyName
  const phone = extractPhone(v)
  if (phone) raw.partyPhone = phone
  if (bank) {
    raw.amount = bank.absAmount.toFixed(2)
    if (bank.ledgerName) raw.mode = bank.ledgerName
  }
  const cheque = asString(v.CHEQUENO)
  if (cheque) raw.referenceNumber = cheque
  const narration = asString(v.NARRATION)
  if (narration) raw.notes = narration
  extractInvoiceNumber(entries, raw)

  if (!raw.partyName && !raw.amount) return null
  return { sourceIndex: index, raw }
}

export function extractReceiptVouchers(
  parsed: unknown,
): TallyReceiptVoucher[] {
  const found: unknown[] = []
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    const obj = n as Record<string, unknown>
    if ('VOUCHER' in obj) {
      const v = obj.VOUCHER
      if (Array.isArray(v)) found.push(...v)
      else found.push(v)
    }
    for (const k of Object.keys(obj)) {
      if (k === 'VOUCHER') continue
      walk(obj[k])
    }
  }
  walk(parsed)
  return found.filter(
    (c): c is TallyReceiptVoucher => !!c && typeof c === 'object',
  )
}
