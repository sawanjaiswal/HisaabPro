/**
 * Tenant-scoping model SSOT (File #1, capability: tenant-scoping).
 *
 * Partitions every Prisma model into exactly one of three classes:
 *   - DIRECTLY-scoped  — has a `businessId` scalar. DERIVED from DMMF (drift-proof).
 *   - CHILD-scoped     — no `businessId`; reaches the tenant via ONE fk hop to a
 *                        scoped parent. Hand-maintained (needs the human judgment of
 *                        WHICH fk), validated column-by-column by test #14.
 *   - GLOBAL           — no `businessId`, intentionally unscoped (platform data).
 *                        Each entry carries a reason; test #14 forbids a
 *                        `businessId`-bearing model from hiding here.
 *
 * A model that is none of the three fails the completeness test (§5.3) — a new
 * schema model can never silently fall through to "global passthrough".
 */
import { Prisma } from '@prisma/client'

// --- DIRECTLY-scoped: derived from DMMF, never transcribed (architect note) ---
export const SCOPED_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'businessId' && f.kind === 'scalar'))
    .map((m) => m.name),
)

// --- CHILD-scoped: 27 rows. { fk (scalar column on child) -> parent (scoped) } ---
export interface ChildScopeRule {
  /** scalar FK column on the child; must be relationFromFields[0] of a real relation */
  fk: string
  /** the relation's target model — must be a directly-scoped (businessId) model */
  parent: string
}
export const CHILD_SCOPED: ReadonlyMap<string, ChildScopeRule> = new Map<string, ChildScopeRule>([
  ['PartyAddress', { fk: 'partyId', parent: 'Party' }],
  ['PartyCustomFieldValue', { fk: 'partyId', parent: 'Party' }],
  ['OpeningBalance', { fk: 'partyId', parent: 'Party' }],
  ['PartyPricing', { fk: 'partyId', parent: 'Party' }],
  ['PriceListEntry', { fk: 'priceListId', parent: 'PriceList' }],
  ['ProductCustomFieldValue', { fk: 'productId', parent: 'Product' }],
  ['DocumentLineItem', { fk: 'documentId', parent: 'Document' }],
  ['DocumentAdditionalCharge', { fk: 'documentId', parent: 'Document' }],
  ['DocumentShareLog', { fk: 'documentId', parent: 'Document' }],
  ['PaymentAllocation', { fk: 'paymentId', parent: 'Payment' }],
  ['PaymentDiscount', { fk: 'paymentId', parent: 'Payment' }],
  ['GstReconciliationEntry', { fk: 'reconciliationId', parent: 'GstReconciliation' }],
  ['JournalEntryLine', { fk: 'journalEntryId', parent: 'JournalEntry' }],
  ['LoanTransaction', { fk: 'loanAccountId', parent: 'LoanAccount' }],
  ['StockVerificationItem', { fk: 'verificationId', parent: 'StockVerification' }],
  ['JobItem', { fk: 'jobId', parent: 'Job' }],
  ['CustomOrderItem', { fk: 'customOrderId', parent: 'CustomOrder' }],
  ['CustomOrderAdvance', { fk: 'customOrderId', parent: 'CustomOrder' }],
  ['CashEntryEvent', { fk: 'cashEntryId', parent: 'CashEntry' }],
  ['PosSaleItem', { fk: 'posSaleId', parent: 'PosSale' }],
  ['PosSaleEvent', { fk: 'posSaleId', parent: 'PosSale' }],
  ['BomComponent', { fk: 'bomId', parent: 'Bom' }],
  ['ProductionRunComponent', { fk: 'productionRunId', parent: 'ProductionRun' }],
  ['MarketingCampaignRecipient', { fk: 'campaignId', parent: 'MarketingCampaign' }],
  ['ReminderInstance', { fk: 'ruleId', parent: 'ReminderRule' }],
  ['AppointmentStatusEvent', { fk: 'appointmentId', parent: 'Appointment' }],
  ['ImportJobRow', { fk: 'jobId', parent: 'ImportJob' }], // CF-1: was importJobId
])

// --- GLOBAL: 24 rows. Platform data with no tenant. Reason is documentation +
//     the completeness-test's "no businessId model may sit here" guard. ---
export const GLOBAL_ALLOWLIST: ReadonlyMap<string, string> = new Map<string, string>([
  ['User', 'account identity — spans businesses'],
  ['Business', 'the tenant root itself'],
  ['RefreshToken', 'session token — keyed by userId'],
  ['OtpCode', 'auth artifact — keyed by phone'],
  ['IdempotencyLog', 'request-dedupe — keyed by idempotency key'],
  ['Feedback', 'product feedback — keyed by userId, cross-business'],
  ['ReferralCode', 'referral program — keyed by userId'],
  ['ReferralEvent', 'referral program — keyed by userId'],
  ['ReferralReward', 'referral program — keyed by userId'],
  ['ReferralWithdrawal', 'referral program — keyed by userId'],
  ['UserAppSettings', 'per-user app prefs — keyed by userId'],
  ['AdminUser', 'platform admin identity'],
  ['AdminAction', 'platform admin audit'],
  ['UserSuspension', 'platform moderation — keyed by userId'],
  ['HsnCode', 'static reference data (tax HSN codes)'],
  ['EInvoice', 'GST e-invoice — scoped by userId in service layer'],
  ['EWayBill', 'GST e-way bill — scoped by userId in service layer'],
  ['Coupon', 'platform-global billing coupon (createdBy → AdminUser)'],
  ['CouponRedemption', 'user-owned billing artifact; scoped by userId in service layer'],
  ['WebAuthnCredential', 'passkey — keyed by userId'],
  ['FeatureAddon', 'platform-global product catalog of paid add-ons'],
  ['WebhookEvent', 'provider webhook inbox — global, gated by signature'],
  ['PinResetToken', 'auth artifact — keyed by userId'],
  ['DriveBackupConnection', 'per-user backup integration — keyed by userId'],
  ['UnscopedAccessLog', 'the cross-tenant-access audit log itself — platform-global (M2)'],
])

// --- Per-model scalar FKs whose relation target is a DIRECTLY-scoped model.
//     Used by the connect-guard (B13) and the H1 data-guard (scalar-FK reassign).
//     DERIVED from DMMF. ---
export interface ScopedFk {
  /** scalar FK column on the owning model */
  fk: string
  /** the directly-scoped target model to resolve the FK against */
  parent: string
  /** relation field name (for nested connect/connectOrCreate lookups) */
  relation: string
}
export const SCOPED_RELATION_FIELDS: ReadonlyMap<string, ReadonlyArray<ScopedFk>> = new Map(
  Prisma.dmmf.datamodel.models.map((m) => {
    const fks: ScopedFk[] = []
    for (const f of m.fields) {
      if (f.kind !== 'object' || !f.relationFromFields || f.relationFromFields.length !== 1) continue
      if (!SCOPED_MODELS.has(f.type)) continue // only guard FKs to directly-scoped parents
      fks.push({ fk: f.relationFromFields[0], parent: f.type, relation: f.name })
    }
    return [m.name, fks] as const
  }),
)

export function isDirectlyScoped(model: string): boolean {
  return SCOPED_MODELS.has(model)
}
export function childRule(model: string): ChildScopeRule | undefined {
  return CHILD_SCOPED.get(model)
}
/** true if the model carries tenant data (directly- or child-scoped). */
export function isTenantModel(model: string): boolean {
  return SCOPED_MODELS.has(model) || CHILD_SCOPED.has(model)
}
export function scopedFksOf(model: string): ReadonlyArray<ScopedFk> {
  return SCOPED_RELATION_FIELDS.get(model) ?? []
}
