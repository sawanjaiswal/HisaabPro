/**
 * Business Service
 * Creates a business with owner record and seeds default categories.
 * Uses a transaction so everything succeeds or nothing does.
 */

import { prisma } from '../lib/prisma.js'
import { conflictError, validationError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import { DEFAULT_CATEGORIES } from '../config/defaults.js'
import type { CreateBusinessInput } from '../schemas/business.schemas.js'
import { ensureSystemRoles } from './settings.service.js'

const MAX_BUSINESSES = 10

export async function createBusiness(userId: string, data: CreateBusinessInput) {
  logger.info('Creating business', { userId, businessName: data.name })

  // Guard: max 10 active businesses per user
  const activeCount = await prisma.businessUser.count({
    where: { userId, isActive: true },
  })
  if (activeCount >= MAX_BUSINESSES) {
    throw validationError('You have reached the maximum of 10 businesses')
  }

  // If cloning, verify user owns the source business
  if (data.cloneFromBusinessId) {
    const sourceOwnership = await prisma.businessUser.findFirst({
      where: { userId, businessId: data.cloneFromBusinessId, role: 'owner' },
      select: { id: true },
    })
    if (!sourceOwnership) {
      throw validationError('You do not own the business you are trying to clone from')
    }
  }

  const business = await prisma.$transaction(async (tx) => {
    // 1. Create the business
    const created = await tx.business.create({
      data: {
        name: data.name,
        businessType: data.businessType ?? 'general',
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        logoUrl: true,
        businessType: true,
        currencyCode: true,
        financialYearStart: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // 2. Create BusinessUser record (owner role)
    await tx.businessUser.create({
      data: {
        userId,
        businessId: created.id,
        role: 'owner',
        isActive: true,
        status: 'ACTIVE',
      },
    })

    // 3. Seed default categories
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        businessId: created.id,
        name: cat.name,
        type: 'PREDEFINED',
        color: cat.color,
        sortOrder: cat.sortOrder,
      })),
    })

    // 4. Clone settings from source business (if requested)
    if (data.cloneFromBusinessId) {
      const sourceId = data.cloneFromBusinessId

      // Clone DocumentSettings
      const srcDocSettings = await tx.documentSettings.findUnique({
        where: { businessId: sourceId },
      })
      if (srcDocSettings) {
        await tx.documentSettings.create({
          data: {
            businessId: created.id,
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

      // Clone CustomFieldDefinitions
      const srcCustomFields = await tx.customFieldDefinition.findMany({
        where: { businessId: sourceId },
      })
      if (srcCustomFields.length > 0) {
        await tx.customFieldDefinition.createMany({
          data: srcCustomFields.map((f) => ({
            businessId: created.id,
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

      // Clone TermsAndConditionsTemplates
      const srcTerms = await tx.termsAndConditionsTemplate.findMany({
        where: { businessId: sourceId },
      })
      if (srcTerms.length > 0) {
        await tx.termsAndConditionsTemplate.createMany({
          data: srcTerms.map((t) => ({
            businessId: created.id,
            name: t.name,
            content: t.content,
            isDefault: t.isDefault,
            appliesTo: t.appliesTo,
          })),
        })
      }

      // Clone DocumentNumberSeries (reset currentSequence to 0)
      const srcDocSeries = await tx.documentNumberSeries.findMany({
        where: { businessId: sourceId },
      })
      if (srcDocSeries.length > 0) {
        await tx.documentNumberSeries.createMany({
          data: srcDocSeries.map((s) => ({
            businessId: created.id,
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

      // Clone ExchangeRates
      const srcRates = await tx.exchangeRate.findMany({
        where: { businessId: sourceId },
      })
      if (srcRates.length > 0) {
        await tx.exchangeRate.createMany({
          data: srcRates.map((r) => ({
            businessId: created.id,
            fromCurrency: r.fromCurrency,
            toCurrency: r.toCurrency,
            rate: r.rate,
            effectiveDate: r.effectiveDate,
            source: r.source,
          })),
        })
      }
    }

    return created
  })

  // Seed system roles for the new business
  await ensureSystemRoles(business.id)

  logger.info('Business created', { businessId: business.id, userId })
  return business
}

const BUSINESS_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  logoUrl: true,
  businessType: true,
  currencyCode: true,
  financialYearStart: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function getBusiness(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: BUSINESS_SELECT,
  })
  if (!business) throw conflictError('Business not found')
  return business
}

export async function updateBusiness(
  businessId: string,
  data: Partial<Omit<CreateBusinessInput, never>>
) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.businessType !== undefined && { businessType: data.businessType }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.pincode !== undefined && { pincode: data.pincode }),
    },
    select: BUSINESS_SELECT,
  })
  return business
}
