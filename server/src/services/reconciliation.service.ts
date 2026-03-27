/**
 * GSTR-1 Reconciliation Service
 *
 * Compares sale invoices in our system against uploaded GSTR portal data.
 * All amounts stored in PAISE (integer). Portal data arrives in RUPEES (float).
 *
 * Matching algorithm:
 *   1. Build a Map of our invoices keyed by documentNumber (normalised)
 *   2. For each GSTR portal entry — attempt exact match by invoice number
 *   3. Matched: compare taxableValue + taxAmount within 1 paisa tolerance → MATCHED or MISMATCHED
 *   4. Remaining our invoices (not matched) → MISSING_IN_GSTR
 *   5. Remaining GSTR entries (not matched) → EXTRA_IN_GSTR
 *   6. Persist all entries + update summary counts in a single transaction
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError } from '../lib/errors.js'
import type { StartReconciliationInput, ReconciliationEntryFilter, ListReconciliationsQuery } from '../schemas/reconciliation.schemas.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePeriodRange(period: string): { gte: Date; lte: Date } {
  const [year, month] = period.split('-').map(Number)
  return {
    gte: new Date(year, month - 1, 1),
    lte: new Date(year, month, 0, 23, 59, 59, 999),
  }
}

/** Convert rupees (float) to paise (integer) — round to nearest paisa */
function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Normalise invoice numbers for matching (uppercase, strip whitespace) */
function normaliseInvoiceNumber(num: string): string {
  return num.trim().toUpperCase()
}

const MATCH_TOLERANCE_PAISE = 1 // 1 paisa tolerance for floating-point artefacts

// ─── Start Reconciliation ─────────────────────────────────────────────────────

export async function startReconciliation(businessId: string, data: StartReconciliationInput) {
  const { period, reconType, gstrData } = data
  const range = parsePeriodRange(period)

  // Fetch our SALE_INVOICE documents for the period
  const ourDocs = await prisma.document.findMany({
    where: {
      businessId,
      type: 'SALE_INVOICE',
      status: 'SAVED',
      documentDate: range,
      deletedAt: null,
    },
    select: {
      id: true,
      documentNumber: true,
      documentDate: true,
      totalTaxableValue: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      totalCess: true,
      party: { select: { gstin: true, name: true } },
    },
    take: 5000, // report: bounded by period filter
  })

  // Build lookup map by normalised documentNumber
  const ourDocMap = new Map<string, typeof ourDocs[number]>()
  for (const doc of ourDocs) {
    if (doc.documentNumber) {
      ourDocMap.set(normaliseInvoiceNumber(doc.documentNumber), doc)
    }
  }

  // Track which of our docs and GSTR entries have been matched
  const matchedOurDocNumbers = new Set<string>()

  type EntryData = Parameters<typeof prisma.gstReconciliationEntry.create>[0]['data']
  const entries: EntryData[] = []

  let matchedCount = 0
  let mismatchedCount = 0
  let extraInGstrCount = 0

  // Process each GSTR portal entry
  for (const gstrEntry of gstrData) {
    const normKey = normaliseInvoiceNumber(gstrEntry.invoiceNumber)
    const ourDoc = ourDocMap.get(normKey)

    const gstrTaxableValuePaise = rupeesToPaise(gstrEntry.taxableValue)
    const gstrTaxAmountPaise = rupeesToPaise(gstrEntry.taxAmount)

    if (ourDoc) {
      // Found in both — compare amounts
      const bookTaxAmount = ourDoc.totalCgst + ourDoc.totalSgst + ourDoc.totalIgst + ourDoc.totalCess
      const taxableDiff = ourDoc.totalTaxableValue - gstrTaxableValuePaise
      const taxDiff = bookTaxAmount - gstrTaxAmountPaise

      const isMatched =
        Math.abs(taxableDiff) <= MATCH_TOLERANCE_PAISE &&
        Math.abs(taxDiff) <= MATCH_TOLERANCE_PAISE

      const matchStatus = isMatched ? 'MATCHED' : 'MISMATCHED'
      isMatched ? matchedCount++ : mismatchedCount++
      matchedOurDocNumbers.add(normaliseInvoiceNumber(ourDoc.documentNumber!))

      entries.push({
        documentId: ourDoc.id,
        documentNumber: ourDoc.documentNumber,
        documentDate: ourDoc.documentDate,
        partyGstin: ourDoc.party.gstin ?? gstrEntry.gstin,
        partyName: ourDoc.party.name ?? gstrEntry.partyName,
        bookTaxableValue: ourDoc.totalTaxableValue,
        bookTaxAmount,
        gstrInvoiceNumber: gstrEntry.invoiceNumber,
        gstrInvoiceDate: new Date(gstrEntry.invoiceDate),
        gstrTaxableValue: gstrTaxableValuePaise,
        gstrTaxAmount: gstrTaxAmountPaise,
        matchStatus,
        taxableValueDiff: taxableDiff,
        taxAmountDiff: taxDiff,
        reconciliationId: '', // filled after reconciliation record is created
      })
    } else {
      // In GSTR portal but not in our books
      extraInGstrCount++
      entries.push({
        documentId: null,
        documentNumber: null,
        documentDate: null,
        partyGstin: gstrEntry.gstin,
        partyName: gstrEntry.partyName ?? null,
        bookTaxableValue: 0,
        bookTaxAmount: 0,
        gstrInvoiceNumber: gstrEntry.invoiceNumber,
        gstrInvoiceDate: new Date(gstrEntry.invoiceDate),
        gstrTaxableValue: gstrTaxableValuePaise,
        gstrTaxAmount: gstrTaxAmountPaise,
        matchStatus: 'EXTRA_IN_GSTR',
        taxableValueDiff: -gstrTaxableValuePaise,
        taxAmountDiff: -gstrTaxAmountPaise,
        reconciliationId: '',
      })
    }
  }

  // Our docs not found in GSTR portal → MISSING_IN_GSTR
  let missingInGstrCount = 0
  for (const doc of ourDocs) {
    if (!doc.documentNumber) continue
    const normKey = normaliseInvoiceNumber(doc.documentNumber)
    if (!matchedOurDocNumbers.has(normKey)) {
      missingInGstrCount++
      const bookTaxAmount = doc.totalCgst + doc.totalSgst + doc.totalIgst + doc.totalCess
      entries.push({
        documentId: doc.id,
        documentNumber: doc.documentNumber,
        documentDate: doc.documentDate,
        partyGstin: doc.party.gstin ?? null,
        partyName: doc.party.name,
        bookTaxableValue: doc.totalTaxableValue,
        bookTaxAmount,
        gstrInvoiceNumber: null,
        gstrInvoiceDate: null,
        gstrTaxableValue: 0,
        gstrTaxAmount: 0,
        matchStatus: 'MISSING_IN_GSTR',
        taxableValueDiff: doc.totalTaxableValue,
        taxAmountDiff: bookTaxAmount,
        reconciliationId: '',
      })
    }
  }

  // Summary totals
  const totalBookValue = ourDocs.reduce((s, d) => s + d.totalTaxableValue, 0)
  const totalGstrValue = gstrData.reduce((s, e) => s + rupeesToPaise(e.taxableValue), 0)

  // Persist in a single transaction
  const reconciliation = await prisma.$transaction(async (tx) => {
    // Upsert — if same period+type already exists, overwrite it
    const existing = await tx.gstReconciliation.findUnique({
      where: { businessId_period_reconType: { businessId, period, reconType } },
      select: { id: true },
    })

    if (existing) {
      // Delete old entries before re-running
      await tx.gstReconciliationEntry.deleteMany({ where: { reconciliationId: existing.id } })
    }

    const recon = existing
      ? await tx.gstReconciliation.update({
          where: { id: existing.id },
          data: {
            status: 'COMPLETED',
            totalInvoices: ourDocs.length,
            matchedCount,
            mismatchedCount,
            missingInGstrCount,
            extraInGstrCount,
            totalBookValue,
            totalGstrValue,
            differenceValue: totalBookValue - totalGstrValue,
            gstrData: gstrData as object[],
            completedAt: new Date(),
          },
        })
      : await tx.gstReconciliation.create({
          data: {
            businessId,
            period,
            reconType,
            status: 'COMPLETED',
            totalInvoices: ourDocs.length,
            matchedCount,
            mismatchedCount,
            missingInGstrCount,
            extraInGstrCount,
            totalBookValue,
            totalGstrValue,
            differenceValue: totalBookValue - totalGstrValue,
            gstrData: gstrData as object[],
            completedAt: new Date(),
          },
        })

    // Create all entry records with the resolved reconciliationId
    await tx.gstReconciliationEntry.createMany({
      data: entries.map((e) => ({ ...e, reconciliationId: recon.id })),
    })

    return recon
  })

  return reconciliation
}

// ─── Get Reconciliation Summary ───────────────────────────────────────────────

export async function getReconciliation(businessId: string, reconId: string) {
  const recon = await prisma.gstReconciliation.findFirst({
    where: { id: reconId, businessId },
  })
  if (!recon) throw notFoundError('Reconciliation')
  return recon
}

// ─── Get Reconciliation Entries (paginated) ───────────────────────────────────

export async function getReconciliationEntries(
  businessId: string,
  reconId: string,
  filters: ReconciliationEntryFilter,
) {
  // Verify ownership
  const recon = await prisma.gstReconciliation.findFirst({
    where: { id: reconId, businessId },
    select: { id: true },
  })
  if (!recon) throw notFoundError('Reconciliation')

  const { matchStatus, page, limit } = filters
  const skip = (page - 1) * limit

  const [entries, total] = await Promise.all([
    prisma.gstReconciliationEntry.findMany({
      where: {
        reconciliationId: reconId,
        ...(matchStatus ? { matchStatus } : {}),
      },
      orderBy: { matchStatus: 'asc' },
      skip,
      take: limit,
    }),
    prisma.gstReconciliationEntry.count({
      where: {
        reconciliationId: reconId,
        ...(matchStatus ? { matchStatus } : {}),
      },
    }),
  ])

  return { entries, total, page, limit, totalPages: Math.ceil(total / limit) }
}

// ─── List Reconciliations (paginated) ────────────────────────────────────────

export async function listReconciliations(
  businessId: string,
  filters: ListReconciliationsQuery,
) {
  const { period, status, page, limit } = filters
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(period ? { period } : {}),
    ...(status ? { status } : {}),
  }

  const [reconciliations, total] = await Promise.all([
    prisma.gstReconciliation.findMany({
      where,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true,
        period: true,
        reconType: true,
        status: true,
        totalInvoices: true,
        matchedCount: true,
        mismatchedCount: true,
        missingInGstrCount: true,
        extraInGstrCount: true,
        totalBookValue: true,
        totalGstrValue: true,
        differenceValue: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.gstReconciliation.count({ where }),
  ])

  return { reconciliations, total, page, limit, totalPages: Math.ceil(total / limit) }
}

// ─── Delete Reconciliation ────────────────────────────────────────────────────

export async function deleteReconciliation(businessId: string, reconId: string) {
  const recon = await prisma.gstReconciliation.findFirst({
    where: { id: reconId, businessId },
    select: { id: true },
  })
  if (!recon) throw notFoundError('Reconciliation')

  // Entries cascade via onDelete: Cascade on the relation
  await prisma.gstReconciliation.delete({ where: { id: reconId } })
}
