/**
 * Business clone helper — copies settings from a source business into a
 * newly-created destination business. Called inside the createBusiness
 * transaction so all clones share the parent's atomicity.
 */

import type { ExtendedPrismaClient } from '../lib/prisma.js'

type Tx = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export async function cloneBusinessSettings(
  tx: Tx,
  sourceId: string,
  destId: string
) {
  const srcDocSettings = await tx.documentSettings.findUnique({ where: { businessId: sourceId } })
  if (srcDocSettings) {
    await tx.documentSettings.create({
      data: {
        businessId: destId,
        defaultPaymentTerms: srcDocSettings.defaultPaymentTerms,
        roundOffTo: srcDocSettings.roundOffTo,
        showProfitDuringBilling: srcDocSettings.showProfitDuringBilling,
        allowFutureDates: srcDocSettings.allowFutureDates,
        transactionLockDays: srcDocSettings.transactionLockDays,
        recycleBinRetentionDays: srcDocSettings.recycleBinRetentionDays,
        autoShareOnSave: srcDocSettings.autoShareOnSave,
        autoShareChannel: srcDocSettings.autoShareChannel,
        autoShareFormat: srcDocSettings.autoShareFormat,
      },
    })
  }

  const srcCustomFields = await tx.customFieldDefinition.findMany({ where: { businessId: sourceId } })
  if (srcCustomFields.length > 0) {
    await tx.customFieldDefinition.createMany({
      data: srcCustomFields.map((f) => ({
        businessId: destId,
        name: f.name,
        fieldType: f.fieldType,
        options: f.options,
        required: f.required,
        showOnInvoice: f.showOnInvoice,
        entityType: f.entityType,
        sortOrder: f.sortOrder,
      })),
    })
  }

  const srcTerms = await tx.termsAndConditionsTemplate.findMany({ where: { businessId: sourceId } })
  if (srcTerms.length > 0) {
    await tx.termsAndConditionsTemplate.createMany({
      data: srcTerms.map((t) => ({
        businessId: destId,
        name: t.name,
        content: t.content,
        isDefault: t.isDefault,
        appliesTo: t.appliesTo,
      })),
    })
  }

  const srcDocSeries = await tx.documentNumberSeries.findMany({ where: { businessId: sourceId } })
  if (srcDocSeries.length > 0) {
    await tx.documentNumberSeries.createMany({
      data: srcDocSeries.map((s) => ({
        businessId: destId,
        documentType: s.documentType,
        financialYear: s.financialYear,
        prefix: s.prefix,
        suffix: s.suffix,
        separator: s.separator,
        paddingDigits: s.paddingDigits,
        currentSequence: 0, // reset — new business starts fresh
        startingNumber: s.startingNumber,
        resetOnNewYear: s.resetOnNewYear,
      })),
    })
  }

  const srcRates = await tx.exchangeRate.findMany({ where: { businessId: sourceId } })
  if (srcRates.length > 0) {
    await tx.exchangeRate.createMany({
      data: srcRates.map((r) => ({
        businessId: destId,
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: r.rate,
        effectiveDate: r.effectiveDate,
        source: r.source,
      })),
    })
  }
}
