/**
 * Tally Export — Generate Tally-compatible XML for journal entries and ledger masters
 */

import { prisma } from '../../lib/prisma.js'

// ─── Tally Helpers ───────────────────────────────────────────────────────────

/** Escape special XML characters */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Format date as YYYYMMDD for Tally */
function tallyDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Convert paise to rupees string for Tally (2 decimal places) */
function tallyAmount(paise: number): string {
  return (paise / 100).toFixed(2)
}

/** Map our journal entry type to Tally voucher type */
function tallyJournalVoucherType(jeType: string): string {
  const map: Record<string, string> = {
    SALES: 'Sales',
    PURCHASE: 'Purchase',
    RECEIPT: 'Receipt',
    PAYMENT: 'Payment',
    CONTRA: 'Contra',
    JOURNAL: 'Journal',
    EXPENSE: 'Payment',
    CREDIT_NOTE: 'Credit Note',
    DEBIT_NOTE: 'Debit Note',
    OPENING: 'Journal',
    FY_CLOSURE: 'Journal',
  }
  return map[jeType] ?? 'Journal'
}

/** Map our account type to Tally parent group */
function tallyGroup(type: string, subType: string | null): string {
  if (type === 'ASSET') {
    if (subType === 'CASH') return 'Cash-in-Hand'
    if (subType === 'BANK') return 'Bank Accounts'
    if (subType === 'RECEIVABLE') return 'Sundry Debtors'
    if (subType === 'INVENTORY') return 'Stock-in-Hand'
    if (subType === 'FIXED_ASSET') return 'Fixed Assets'
    return 'Current Assets'
  }
  if (type === 'LIABILITY') {
    if (subType === 'PAYABLE') return 'Sundry Creditors'
    if (subType === 'TAX') return 'Duties & Taxes'
    if (subType === 'LOAN') return 'Loans (Liability)'
    return 'Current Liabilities'
  }
  if (type === 'EQUITY') return "Capital Account"
  if (type === 'INCOME') return 'Sales Accounts'
  if (type === 'EXPENSE') {
    if (subType === 'PURCHASE') return 'Purchase Accounts'
    return 'Indirect Expenses'
  }
  return 'Miscellaneous Expenses (ASSET)'
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function getTallyExport(businessId: string, from: Date, to: Date): Promise<string> {
  // Fetch all posted journal entries in the date range
  const entries = await prisma.journalEntry.findMany({
    where: {
      businessId,
      status: 'POSTED',
      date: { gte: from, lte: to },
    },
    select: {
      id: true,
      entryNumber: true,
      date: true,
      narration: true,
      type: true,
      sourceNumber: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          narration: true,
          account: { select: { name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { date: 'asc' },
    take: 5000, // report: bounded by date range filter
  })

  // Fetch all active ledger accounts for the business (for ledger masters export)
  const accounts = await prisma.ledgerAccount.findMany({
    where: { businessId, isActive: true },
    select: { name: true, type: true, subType: true },
    take: 500, // chart of accounts: typically < 500 accounts per business
  })

  const ledgerMasters = accounts
    .map(
      (a) => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${escapeXml(a.name)}" RESERVEDNAME="">
        <PARENT>${escapeXml(tallyGroup(a.type, a.subType))}</PARENT>
      </LEDGER>
    </TALLYMESSAGE>`,
    )
    .join('')

  const vouchers = entries
    .map((je) => {
      const voucherType = tallyJournalVoucherType(je.type)
      const refNumber = je.sourceNumber ?? je.entryNumber

      const ledgerEntries = je.lines
        .map((line) => {
          // In Tally: ISDEEMEDPOSITIVE is TRUE for debit lines in Dr/Cr vouchers
          const isDebit = line.debit > 0
          const amount = isDebit ? line.debit : line.credit
          // For Sales/Purchase/Journal: debit lines have ISDEEMEDPOSITIVE=YES
          const isDeemedPositive = isDebit ? 'Yes' : 'No'
          return `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(line.account.name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${isDeemedPositive}</ISDEEMEDPOSITIVE>
          <AMOUNT>${isDebit ? tallyAmount(amount) : `-${tallyAmount(amount)}`}</AMOUNT>
          ${line.narration ? `<NARRATION>${escapeXml(line.narration)}</NARRATION>` : ''}
        </ALLLEDGERENTRIES.LIST>`
        })
        .join('')

      return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER REMOTEID="${escapeXml(je.id)}" VCHTYPE="${escapeXml(voucherType)}" ACTION="Create">
        <DATE>${tallyDate(je.date)}</DATE>
        <VOUCHERTYPENAME>${escapeXml(voucherType)}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${escapeXml(refNumber ?? je.entryNumber)}</VOUCHERNUMBER>
        ${je.narration ? `<NARRATION>${escapeXml(je.narration)}</NARRATION>` : ''}
        ${ledgerEntries}
      </VOUCHER>
    </TALLYMESSAGE>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>$$CurrentCompany</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${ledgerMasters}
        ${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}
