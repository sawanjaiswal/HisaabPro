import { z } from 'zod'
import {
  PARTY_TYPES,
  ADDRESS_TYPES,
  CREDIT_LIMIT_MODES,
  OPENING_BALANCE_TYPES,
} from '../../../shared/enums.js'

// === Regex constants ===

const PHONE_REGEX = /^[6-9]\d{9}$/
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const PINCODE_REGEX = /^\d{6}$/
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

// === Sub-schemas ===

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  line1: z.string().min(1, 'Address line 1 is required').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  pincode: z.string().regex(PINCODE_REGEX, 'Pincode must be 6 digits'),
  type: z.enum(ADDRESS_TYPES).default('BILLING'),
  isDefault: z.boolean().default(false),
})

const customFieldValueSchema = z.object({
  fieldId: z.string().min(1),
  value: z.string().min(1, 'Custom field value is required'),
})

const openingBalanceSchema = z.object({
  amount: z.number().int().min(0, 'Opening balance must be non-negative'),
  type: z.enum(OPENING_BALANCE_TYPES),
  asOfDate: z.string().datetime({ message: 'asOfDate must be a valid ISO date' }),
  notes: z.string().max(500).optional(),
})

// === Party schemas ===

export const createPartySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().regex(PHONE_REGEX, 'Valid 10-digit Indian mobile number required').optional(),
  email: z.string().email('Invalid email address').optional(),
  companyName: z.string().max(200).optional(),
  type: z.enum(PARTY_TYPES).default('CUSTOMER'),
  groupId: z.string().optional(),
  tags: z.array(z.string().max(50)).default([]),
  gstin: z.string().regex(GSTIN_REGEX, 'Invalid GSTIN format').optional(),
  pan: z.string().regex(PAN_REGEX, 'Invalid PAN format').optional(),
  creditLimit: z.number().int().min(0).default(0), // in paise
  creditLimitMode: z.enum(CREDIT_LIMIT_MODES).default('WARN'),
  notes: z.string().max(1000).optional(),
  addresses: z.array(addressSchema).default([]),
  customFields: z.array(customFieldValueSchema).default([]),
  openingBalance: openingBalanceSchema.optional(),
})

export const updatePartySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().regex(PHONE_REGEX, 'Valid 10-digit Indian mobile number required').optional(),
  email: z.string().email('Invalid email address').optional(),
  companyName: z.string().max(200).optional(),
  type: z.enum(PARTY_TYPES).optional(),
  groupId: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
  gstin: z.string().regex(GSTIN_REGEX, 'Invalid GSTIN format').nullable().optional(),
  pan: z.string().regex(PAN_REGEX, 'Invalid PAN format').nullable().optional(),
  creditLimit: z.number().int().min(0).optional(),
  creditLimitMode: z.enum(CREDIT_LIMIT_MODES).optional(),
  notes: z.string().max(1000).nullable().optional(),
  customFields: z.array(customFieldValueSchema).optional(),
})

export const listPartiesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().max(100).optional(),
  type: z.enum(PARTY_TYPES).optional(),
  groupId: z.string().optional(),
  hasOutstanding: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().default(true),
  sortBy: z.enum(['name', 'createdAt', 'outstandingBalance', 'lastTransactionAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  tags: z.union([z.string(), z.array(z.string())]).transform((v) =>
    Array.isArray(v) ? v : [v]
  ).optional(),
})

// === Address schemas ===

export const createAddressSchema = addressSchema

export const updateAddressSchema = z.object({
  label: z.string().max(50).optional(),
  line1: z.string().min(1).max(200).optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  pincode: z.string().regex(PINCODE_REGEX, 'Pincode must be 6 digits').optional(),
  type: z.enum(ADDRESS_TYPES).optional(),
  isDefault: z.boolean().optional(),
})

// === Party group schemas ===

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(HEX_COLOR_REGEX, 'Color must be a valid hex code (e.g. #6B7280)').default('#6B7280'),
})

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(HEX_COLOR_REGEX, 'Color must be a valid hex code').optional(),
})

export const deleteGroupSchema = z.object({
  reassignTo: z.string().optional(),
})

// === Custom field schemas ===

export const createCustomFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required').max(100),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DROPDOWN']),
  options: z.array(z.string().max(100)).optional(),
  required: z.boolean().default(false),
  showOnInvoice: z.boolean().default(false),
  entityType: z.enum(['PARTY', 'PRODUCT', 'INVOICE']).default('PARTY'),
  sortOrder: z.number().int().min(0).default(0),
}).superRefine((data, ctx) => {
  if (data.fieldType === 'DROPDOWN' && (!data.options || data.options.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'DROPDOWN fields require at least one option',
      path: ['options'],
    })
  }
})

export const updateCustomFieldSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  options: z.array(z.string().max(100)).optional(),
  required: z.boolean().optional(),
  showOnInvoice: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// === Pricing schemas ===

const pricingItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  price: z.number().int().positive('Price must be a positive integer (in paise)'),
  minQty: z.number().int().min(1).default(1),
})

export const setPricingSchema = z.object({
  pricing: z.array(pricingItemSchema).min(1, 'At least one pricing entry is required'),
})

export const listPricingQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// === Inferred types ===

export type CreatePartyInput = z.infer<typeof createPartySchema>
export type UpdatePartyInput = z.infer<typeof updatePartySchema>
export type ListPartiesQuery = z.infer<typeof listPartiesSchema>
export type CreateAddressInput = z.infer<typeof createAddressSchema>
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>
export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type DeleteGroupInput = z.infer<typeof deleteGroupSchema>
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>
export type SetPricingInput = z.infer<typeof setPricingSchema>
export type ListPricingQuery = z.infer<typeof listPricingQuerySchema>
