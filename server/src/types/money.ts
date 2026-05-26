/**
 * Money SSOT — paise as a branded Int.
 *
 * HisaabPro convention: money on the wire and in the DB is always paise Int.
 * Float/Decimal money is a SSOT violation (DudhHisaab burned us — rupee/paise
 * mixing leaks one digit at a time and you find out months later).
 *
 * The brand prevents accidental assignment from a plain `number` (typical when
 * `Number(decimal)` coerces a Decimal column or `parseFloat` parses a string).
 * Mint a `Paise` value only via `paise(x)` or the Zod helper `zPaise` — both
 * assert integer + finite + non-negative.
 *
 * Aggregations greater than INT32 (~Rs 2.14 Cr) must use BIGINT in the DB and
 * the matching JS type `bigint`. Use `PaiseBig` for lifetime/sum columns.
 */

declare const PaiseBrand: unique symbol
declare const PaiseBigBrand: unique symbol

export type Paise = number & { readonly [PaiseBrand]: 'paise' }
export type PaiseBig = bigint & { readonly [PaiseBigBrand]: 'paise-bigint' }

export function paise(n: number): Paise {
  if (!Number.isInteger(n) || !Number.isFinite(n)) {
    throw new TypeError(`paise() expects integer; got ${n}`)
  }
  if (n < 0) throw new RangeError(`paise() expects non-negative; got ${n}`)
  return n as Paise
}

export function paiseBig(n: bigint | number): PaiseBig {
  const v = typeof n === 'bigint' ? n : BigInt(n)
  if (v < 0n) throw new RangeError(`paiseBig() expects non-negative; got ${v}`)
  return v as PaiseBig
}

/**
 * Convert rupees (Decimal-as-string or number) to paise Int. Use only in the
 * backfill script — production code should never see rupees.
 */
export function rupeesToPaise(rupees: number | string): Paise {
  const r = typeof rupees === 'string' ? parseFloat(rupees) : rupees
  return paise(Math.round(r * 100))
}

/**
 * Human-display only — convert paise Int back to "Rs 1,00,000.00" for error
 * messages and the toast surface. Never use this value for arithmetic.
 */
export function formatRupees(p: Paise | PaiseBig | number | bigint): string {
  const num = typeof p === 'bigint' ? Number(p) : (p as number)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(num / 100)
}
