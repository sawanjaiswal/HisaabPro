/** Business Verticals — SSOT
 *
 * Drives nav filtering, terminology, and (Phase 2) default settings.
 * Consumed by useVertical() / useTerm() hooks.
 *
 * Stays in sync with server/src/schemas/business.schemas.ts BUSINESS_TYPES.
 */

import type { TranslationKey } from '@/lib/translations'

export type BusinessType =
  | 'general'
  | 'retail'
  | 'wholesale'
  | 'manufacturing'
  | 'services'
  | 'restaurant'
  | 'pharmacy'
  | 'bakery'
  | 'salon'
  | 'clinic'
  | 'tailor'
  | 'freelancer'
  | 'other'

/** Stable keys for nav items in MORE_MENU + BottomNav. */
export type NavKey =
  | 'bill-scan' | 'recurring' | 'templates' | 'data-import' | 'items-library'
  | 'payments' | 'outstanding' | 'expenses' | 'other-income' | 'loans' | 'cheques' | 'bank'
  | 'reports' | 'accounting' | 'gst' | 'products'
  | 'greetings' | 'bulk-import'
  | 'settings'
  // bottom nav
  | 'dashboard' | 'invoices' | 'parties'
  // future (Phase 3+)
  | 'jobs' | 'orders' | 'batches' | 'godowns' | 'serial-numbers' | 'stock-verification'

export interface VerticalProfile {
  type: BusinessType
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  iconName: string
  /** Override the term shown in headers / FAB labels. Defaults to "Invoice". */
  invoiceTermKey: TranslationKey
  /** Override the term used for "Item" (line item, product). */
  itemTermKey: TranslationKey
  /** Nav items hidden for this vertical. Empty = show everything. */
  hiddenNavKeys: ReadonlySet<NavKey>
  /** Phase 2 — settings to seed on business creation. */
  defaults?: {
    stockTracking?: boolean
    batchTracking?: boolean
    expiryTracking?: boolean
    serialNumberTracking?: boolean
  }
}

const NONE: ReadonlySet<NavKey> = new Set()

/** Hide everything that doesn't apply to a service business. */
const SERVICES_HIDDEN: ReadonlySet<NavKey> = new Set([
  'batches', 'godowns', 'serial-numbers', 'stock-verification', 'items-library',
])

/** Restaurants don't sell SKUs in the wholesale sense. */
const RESTAURANT_HIDDEN: ReadonlySet<NavKey> = new Set([
  'serial-numbers', 'stock-verification',
])

/** Pharmacies need everything stock-related but no manufacturing. */
const PHARMACY_HIDDEN: ReadonlySet<NavKey> = new Set([
  'serial-numbers',
])

/** Bakeries / tailors are "custom order" — keep stock for ingredients/cloth, drop serials. */
const CUSTOM_ORDER_HIDDEN: ReadonlySet<NavKey> = new Set([
  'serial-numbers', 'stock-verification',
])

/** Salons/clinics/freelancers are pure service. */
const PURE_SERVICE_HIDDEN: ReadonlySet<NavKey> = new Set([
  'batches', 'godowns', 'serial-numbers', 'stock-verification',
  'items-library', 'bulk-import',
])

export const VERTICAL_PROFILES: Record<BusinessType, VerticalProfile> = {
  general: {
    type: 'general',
    labelKey: 'bizGeneral',
    descriptionKey: 'bizGeneralDesc',
    iconName: 'Briefcase',
    invoiceTermKey: 'termInvoice',
    itemTermKey: 'termItem',
    hiddenNavKeys: NONE,
  },
  retail: {
    type: 'retail',
    labelKey: 'bizRetail',
    descriptionKey: 'bizRetailDesc',
    iconName: 'Store',
    invoiceTermKey: 'termBill',
    itemTermKey: 'termItem',
    hiddenNavKeys: NONE,
    defaults: { stockTracking: true },
  },
  wholesale: {
    type: 'wholesale',
    labelKey: 'bizWholesale',
    descriptionKey: 'bizWholesaleDesc',
    iconName: 'Warehouse',
    invoiceTermKey: 'termInvoice',
    itemTermKey: 'termItem',
    hiddenNavKeys: NONE,
    defaults: { stockTracking: true, batchTracking: true },
  },
  manufacturing: {
    type: 'manufacturing',
    labelKey: 'bizManufacturing',
    descriptionKey: 'bizManufacturingDesc',
    iconName: 'Factory',
    invoiceTermKey: 'termInvoice',
    itemTermKey: 'termItem',
    hiddenNavKeys: NONE,
    defaults: { stockTracking: true, batchTracking: true, serialNumberTracking: true },
  },
  services: {
    type: 'services',
    labelKey: 'bizServices',
    descriptionKey: 'bizServicesDesc',
    iconName: 'Wrench',
    invoiceTermKey: 'termQuote',
    itemTermKey: 'termService',
    hiddenNavKeys: SERVICES_HIDDEN,
    defaults: { stockTracking: false },
  },
  restaurant: {
    type: 'restaurant',
    labelKey: 'bizRestaurant',
    descriptionKey: 'bizRestaurantDesc',
    iconName: 'UtensilsCrossed',
    invoiceTermKey: 'termBill',
    itemTermKey: 'termItem',
    hiddenNavKeys: RESTAURANT_HIDDEN,
    defaults: { stockTracking: true },
  },
  pharmacy: {
    type: 'pharmacy',
    labelKey: 'bizPharmacy',
    descriptionKey: 'bizPharmacyDesc',
    iconName: 'Pill',
    invoiceTermKey: 'termBill',
    itemTermKey: 'termItem',
    hiddenNavKeys: PHARMACY_HIDDEN,
    defaults: { stockTracking: true, batchTracking: true, expiryTracking: true },
  },
  bakery: {
    type: 'bakery',
    labelKey: 'bizBakery',
    descriptionKey: 'bizBakeryDesc',
    iconName: 'Cake',
    invoiceTermKey: 'termOrder',
    itemTermKey: 'termCake',
    hiddenNavKeys: CUSTOM_ORDER_HIDDEN,
    defaults: { stockTracking: true, expiryTracking: true },
  },
  salon: {
    type: 'salon',
    labelKey: 'bizSalon',
    descriptionKey: 'bizSalonDesc',
    iconName: 'Scissors',
    invoiceTermKey: 'termBill',
    itemTermKey: 'termService',
    hiddenNavKeys: PURE_SERVICE_HIDDEN,
    defaults: { stockTracking: false },
  },
  clinic: {
    type: 'clinic',
    labelKey: 'bizClinic',
    descriptionKey: 'bizClinicDesc',
    iconName: 'Stethoscope',
    invoiceTermKey: 'termBill',
    itemTermKey: 'termService',
    hiddenNavKeys: PURE_SERVICE_HIDDEN,
    defaults: { stockTracking: false },
  },
  tailor: {
    type: 'tailor',
    labelKey: 'bizTailor',
    descriptionKey: 'bizTailorDesc',
    iconName: 'Shirt',
    invoiceTermKey: 'termOrder',
    itemTermKey: 'termItem',
    hiddenNavKeys: CUSTOM_ORDER_HIDDEN,
    defaults: { stockTracking: true },
  },
  freelancer: {
    type: 'freelancer',
    labelKey: 'bizFreelancer',
    descriptionKey: 'bizFreelancerDesc',
    iconName: 'Laptop',
    invoiceTermKey: 'termInvoice',
    itemTermKey: 'termService',
    hiddenNavKeys: PURE_SERVICE_HIDDEN,
    defaults: { stockTracking: false },
  },
  other: {
    type: 'other',
    labelKey: 'bizOther',
    descriptionKey: 'bizOtherDesc',
    iconName: 'Package',
    invoiceTermKey: 'termInvoice',
    itemTermKey: 'termItem',
    hiddenNavKeys: NONE,
  },
}

/** Ordered list for pickers (general / other last). */
export const VERTICAL_PICKER_ORDER: readonly BusinessType[] = [
  'retail', 'wholesale', 'services', 'restaurant', 'pharmacy',
  'bakery', 'salon', 'clinic', 'tailor', 'manufacturing',
  'freelancer', 'general', 'other',
]

export function getVerticalProfile(type: string | null | undefined): VerticalProfile {
  if (!type) return VERTICAL_PROFILES.general
  return VERTICAL_PROFILES[type as BusinessType] ?? VERTICAL_PROFILES.general
}
