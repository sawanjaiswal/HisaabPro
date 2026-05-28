/** #147 Pure client-side CSV parsing for bank statements. No I/O, no React. */
import { CSV_COLUMN_ALIASES, MAX_CSV_ROWS } from './bank-reconciliation.constants'
import type { ParsedCsvRow, LineDirection } from './bank-reconciliation.types'

export interface CsvParseResult {
  rows: ParsedCsvRow[]
  errorCount: number
  truncated: boolean
}

/** Split a CSV line honouring simple double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function findIndex(header: string[], aliases: readonly string[]): number {
  return header.findIndex((h) => aliases.includes(h.toLowerCase()))
}

/** Parse "1,200.50" or "₹1,200.50" rupees → integer paise. Returns null if unparseable. */
function rupeesToPaise(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/[()]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  return Math.round(Math.abs(value) * 100)
}

function parseDateIso(raw: string): string | null {
  const v = raw.trim()
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? `20${y}` : y
    const iso = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    return Number.isNaN(Date.parse(iso)) ? null : new Date(`${iso}T00:00:00.000Z`).toISOString()
  }
  const ts = Date.parse(v)
  return Number.isNaN(ts) ? null : new Date(v).toISOString()
}

export function parseStatementCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { rows: [], errorCount: 0, truncated: false }

  const header = splitCsvLine(lines[0])
  const idx = {
    date: findIndex(header, CSV_COLUMN_ALIASES.date),
    amount: findIndex(header, CSV_COLUMN_ALIASES.amount),
    debit: findIndex(header, CSV_COLUMN_ALIASES.debit),
    credit: findIndex(header, CSV_COLUMN_ALIASES.credit),
    type: findIndex(header, CSV_COLUMN_ALIASES.type),
    description: findIndex(header, CSV_COLUMN_ALIASES.description),
    reference: findIndex(header, CSV_COLUMN_ALIASES.reference),
  }

  const rows: ParsedCsvRow[] = []
  let errorCount = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const dateRaw = idx.date >= 0 ? cells[idx.date] : ''
    const txnDate = dateRaw ? parseDateIso(dateRaw) : null
    if (!txnDate) {
      errorCount++
      continue
    }

    let amount: number | null = null
    let direction: LineDirection | null = null

    if (idx.debit >= 0 || idx.credit >= 0) {
      const debit = idx.debit >= 0 ? rupeesToPaise(cells[idx.debit] ?? '') : null
      const credit = idx.credit >= 0 ? rupeesToPaise(cells[idx.credit] ?? '') : null
      if (credit && credit > 0) {
        amount = credit
        direction = 'CREDIT'
      } else if (debit && debit > 0) {
        amount = debit
        direction = 'DEBIT'
      }
    } else if (idx.amount >= 0) {
      amount = rupeesToPaise(cells[idx.amount] ?? '')
      const typeRaw = (idx.type >= 0 ? cells[idx.type] : '').toLowerCase()
      const isCredit = /cr|credit|deposit|paid in/.test(typeRaw)
      const isDebit = /dr|debit|withdraw|paid out/.test(typeRaw)
      direction = isCredit ? 'CREDIT' : isDebit ? 'DEBIT' : null
    }

    if (!amount || amount <= 0 || !direction) {
      errorCount++
      continue
    }

    rows.push({
      txnDate,
      amount,
      direction,
      description: idx.description >= 0 ? cells[idx.description]?.slice(0, 500) || null : null,
      referenceNumber: idx.reference >= 0 ? cells[idx.reference]?.slice(0, 100) || null : null,
    })

    if (rows.length >= MAX_CSV_ROWS) return { rows, errorCount, truncated: i < lines.length - 1 }
  }

  return { rows, errorCount, truncated: false }
}
