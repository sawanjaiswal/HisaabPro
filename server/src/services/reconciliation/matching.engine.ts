/**
 * GSTR-1 Reconciliation matching engine.
 *
 * Matching algorithm:
 *   1. Build a Map of our invoices keyed by documentNumber (normalised)
 *   2. For each GSTR portal entry — attempt exact match by invoice number
 *   3. Matched: compare taxableValue + taxAmount within 1 paisa tolerance → MATCHED or MISMATCHED
 *   4. Remaining our invoices (not matched) → MISSING_IN_GSTR
 *   5. Remaining GSTR entries (not matched) → EXTRA_IN_GSTR
 *   6. Persist all entries + update summary counts in a single transaction
 */

import { prisma } from '../../lib/prisma.js'
import type { StartReconciliationInput } from '../../schemas/reconciliation.schemas.js'
import {
  parsePeriodRange,
  rupeesToPaise,
  normaliseInvoiceNumber,
  MATCH_TOLERANCE_PAISE,
} from './helpers.js'

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
    take: 5000, // bounded by period filter
  })

  // Build lookup map by normalised documentNumber
  const ourDocMap = new Map<string, typeof ourDocs[number]>()
  for (const doc of ourDocs) {
    if (doc.documentNumber) {
      ourDocMap.set(normaliseInvoiceNumber(doc.documentNumber), doc)
    }
  }

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
        reconciliationId: '',
      })
    } else {
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

  const totalBookValue = ourDocs.reduce((s, d) => s + d.totalTaxableValue, 0)
  const totalGstrValue = gstrData.reduce((s, e) => s + rupeesToPaise(e.taxableValue), 0)

  // Persist in a single transaction
  const reconciliation = await prisma.$transaction(async (tx) => {
    const existing = await tx.gstReconciliation.findUnique({
      where: { businessId_period_reconType: { businessId, period, reconType } },
      select: { id: true },
    })

    if (existing) {
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

    await tx.gstReconciliationEntry.createMany({
      data: entries.map((e) => ({ ...e, reconciliationId: recon.id })),
    })

    return recon
  })

  return reconciliation
}
