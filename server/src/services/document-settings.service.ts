/**
 * Document Settings Service — business-level document config,
 * digital signature, terms & conditions templates
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError } from '../lib/errors.js'
import type {
  UpdateDocumentSettingsInput,
  CreateTermsTemplateInput,
  UpdateTermsTemplateInput,
  UpdateNumberSeriesInput,
} from '../schemas/document.schemas.js'

// === Document Settings ===

export async function getDocumentSettings(businessId: string) {
  const settings = await prisma.documentSettings.findUnique({
    where: { businessId },
  })
  // Return defaults if not yet configured
  return settings || {
    businessId,
    defaultPaymentTerms: 'COD',
    roundOffTo: 'NEAREST_1',
    showProfitDuringBilling: true,
    allowFutureDates: false,
    transactionLockDays: 0,
    recycleBinRetentionDays: 30,
    autoShareOnSave: false,
    autoShareChannel: 'WHATSAPP',
    autoShareFormat: 'PDF',
  }
}

export async function updateDocumentSettings(
  businessId: string,
  data: UpdateDocumentSettingsInput
) {
  return prisma.documentSettings.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  })
}

// === Digital Signature ===

export async function getSignature(businessId: string) {
  return prisma.digitalSignature.findUnique({
    where: { businessId },
    select: { id: true, imageUrl: true, autoApply: true, createdAt: true },
  })
}

export async function upsertSignature(
  businessId: string,
  data: { imageUrl: string; autoApply?: boolean }
) {
  return prisma.digitalSignature.upsert({
    where: { businessId },
    create: { businessId, imageUrl: data.imageUrl, autoApply: data.autoApply ?? true },
    update: { imageUrl: data.imageUrl, autoApply: data.autoApply },
    select: { id: true, imageUrl: true, autoApply: true, createdAt: true },
  })
}

export async function deleteSignature(businessId: string) {
  const existing = await prisma.digitalSignature.findUnique({
    where: { businessId },
    select: { id: true },
  })
  if (!existing) throw notFoundError('Signature')
  await prisma.digitalSignature.delete({ where: { businessId } })
}

// === Terms & Conditions Templates ===

export async function listTermsTemplates(businessId: string) {
  return prisma.termsAndConditionsTemplate.findMany({
    where: { businessId },
    select: {
      id: true, name: true, content: true,
      isDefault: true, appliesTo: true,
      createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
}

export async function createTermsTemplate(
  businessId: string,
  data: CreateTermsTemplateInput
) {
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.termsAndConditionsTemplate.updateMany({
      where: { businessId, isDefault: true },
      data: { isDefault: false },
    })
  }

  return prisma.termsAndConditionsTemplate.create({
    data: { businessId, ...data },
    select: {
      id: true, name: true, content: true,
      isDefault: true, appliesTo: true,
      createdAt: true, updatedAt: true,
    },
  })
}

export async function updateTermsTemplate(
  businessId: string,
  templateId: string,
  data: UpdateTermsTemplateInput
) {
  const existing = await prisma.termsAndConditionsTemplate.findFirst({
    where: { id: templateId, businessId },
    select: { id: true },
  })
  if (!existing) throw notFoundError('Template')

  if (data.isDefault) {
    await prisma.termsAndConditionsTemplate.updateMany({
      where: { businessId, isDefault: true, id: { not: templateId } },
      data: { isDefault: false },
    })
  }

  return prisma.termsAndConditionsTemplate.update({
    where: { id: templateId },
    data,
    select: {
      id: true, name: true, content: true,
      isDefault: true, appliesTo: true,
      createdAt: true, updatedAt: true,
    },
  })
}

export async function deleteTermsTemplate(businessId: string, templateId: string) {
  const existing = await prisma.termsAndConditionsTemplate.findFirst({
    where: { id: templateId, businessId },
    select: { id: true },
  })
  if (!existing) throw notFoundError('Template')
  await prisma.termsAndConditionsTemplate.delete({ where: { id: templateId } })
}

// === Number Series ===

export async function updateNumberSeries(
  businessId: string,
  documentType: string,
  data: UpdateNumberSeriesInput
) {
  // Get current FY
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const fyStartYear = month >= 4 ? year : year - 1
  const fyEndYear = fyStartYear + 1
  const financialYear = `${String(fyStartYear).slice(-2)}${String(fyEndYear).slice(-2)}`

  return prisma.documentNumberSeries.upsert({
    where: {
      businessId_documentType_financialYear: {
        businessId,
        documentType,
        financialYear,
      },
    },
    create: {
      businessId,
      documentType,
      financialYear,
      ...data,
    },
    update: data,
    select: {
      prefix: true, suffix: true, separator: true,
      paddingDigits: true, currentSequence: true,
      startingNumber: true, resetOnNewYear: true,
    },
  })
}
