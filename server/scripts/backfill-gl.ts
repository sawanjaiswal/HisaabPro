/**
 * GL backfill — post historical SAVED documents, confirmed payments, and
 * confirmed expenses that predate S1 auto-posting.
 *
 * Idempotent by construction: the partial unique index
 * JournalEntry_source_posted_key (businessId, sourceType, sourceId) WHERE
 * status='POSTED' rejects a second POSTED entry for the same source. We skip
 * sources that already have one, and wrap each post in its own transaction so a
 * single bad row can't abort the whole run. Re-running yields 0 new entries.
 *
 * Usage:  tsx scripts/backfill-gl.ts            (live)
 *         tsx scripts/backfill-gl.ts --dry-run  (count only, no writes)
 */
import { prisma } from '../src/lib/prisma.js'
import { postDocument, POSTING_DOC_SELECT } from '../src/services/accounting/posting/post-document.js'
import { postPayment } from '../src/services/accounting/posting/post-payment.js'
import { postExpense } from '../src/services/accounting/posting/post-expense.js'

const DRY = process.argv.includes('--dry-run')
const BACKFILL_USER = 'gl-backfill'

const POSTABLE_DOC = ['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE']
const POSTABLE_PAY = ['PAYMENT_IN', 'PAYMENT_OUT']

interface IdRow { id: string }

/** IDs of sources that already carry a POSTED journal entry (skip these). */
async function postedSourceIds(sourceType: string): Promise<Set<string>> {
  const rows = await prisma.journalEntry.findMany({
    where: { sourceType, status: 'POSTED' },
    select: { sourceId: true },
  })
  return new Set(rows.map((r) => r.sourceId).filter((x): x is string => x !== null))
}

async function backfillDocuments() {
  const done = await postedSourceIds('DOCUMENT')
  const docs = await prisma.document.findMany({
    where: { status: { in: ['SAVED', 'SHARED'] }, type: { in: POSTABLE_DOC } },
    select: { id: true, businessId: true },
  })
  let posted = 0
  for (const { id, businessId } of docs) {
    if (done.has(id)) continue
    if (DRY) { posted++; continue }
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.document.findFirstOrThrow({ where: { id, businessId }, select: POSTING_DOC_SELECT })
        await postDocument(tx, { businessId, userId: BACKFILL_USER, doc: fresh })
      })
      posted++
    } catch (e) {
      console.error(`  document ${id}: ${(e as Error).message}`)
    }
  }
  console.log(`documents: ${posted} ${DRY ? 'would post' : 'posted'} (of ${docs.length} candidates, ${done.size} already posted)`)
}

async function backfillPayments() {
  const done = await postedSourceIds('PAYMENT')
  const pays = await prisma.payment.findMany({
    where: { isDeleted: false, type: { in: POSTABLE_PAY } },
    select: { id: true, businessId: true, type: true, mode: true, amount: true, partyId: true, referenceNumber: true, date: true },
  })
  let posted = 0
  for (const p of pays) {
    if (done.has(p.id)) continue
    if (DRY) { posted++; continue }
    try {
      await prisma.$transaction(async (tx) => {
        await postPayment(tx, { businessId: p.businessId, userId: BACKFILL_USER, payment: p })
      })
      posted++
    } catch (e) {
      console.error(`  payment ${p.id}: ${(e as Error).message}`)
    }
  }
  console.log(`payments: ${posted} ${DRY ? 'would post' : 'posted'} (of ${pays.length} candidates, ${done.size} already posted)`)
}

async function backfillExpenses() {
  const done = await postedSourceIds('EXPENSE')
  const exps = await prisma.expense.findMany({
    where: { isDeleted: false, status: 'CONFIRMED' },
    select: { id: true, businessId: true, amount: true, gstAmount: true, paymentMode: true, date: true, category: { select: { name: true } } },
  })
  let posted = 0
  for (const e of exps) {
    if (done.has(e.id)) continue
    if (DRY) { posted++; continue }
    try {
      await prisma.$transaction(async (tx) => {
        await postExpense(tx, {
          businessId: e.businessId,
          userId: BACKFILL_USER,
          expense: { id: e.id, amount: e.amount, gstAmount: e.gstAmount, paymentMode: e.paymentMode, categoryName: e.category.name, date: e.date },
        })
      })
      posted++
    } catch (err) {
      console.error(`  expense ${e.id}: ${(err as Error).message}`)
    }
  }
  console.log(`expenses: ${posted} ${DRY ? 'would post' : 'posted'} (of ${exps.length} candidates, ${done.size} already posted)`)
}

async function main() {
  console.log(`GL backfill ${DRY ? '(DRY RUN — no writes)' : '(LIVE)'}`)
  await backfillDocuments()
  await backfillPayments()
  await backfillExpenses()
  console.log('done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
