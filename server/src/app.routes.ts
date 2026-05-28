/** Route mount table — extracted from app.ts to keep that file under 250 LOC. */
import type { Express, Router } from 'express'
import authRoutes from './routes/auth/index.js'
import feedbackRoutes from './routes/feedback.js'
import backupRoutes from './routes/backup.js'
import partyRoutes from './routes/party.js'
import partyGroupRoutes from './routes/party-groups.js'
import customFieldRoutes from './routes/custom-fields.js'
import productRoutes from './routes/products/index.js'
import categoryRoutes from './routes/categories.js'
import unitRoutes from './routes/units.js'
import inventorySettingsRoutes from './routes/inventory-settings.js'
import documentRoutes from './routes/documents/index.js'
import documentSettingsRoutes from './routes/document-settings.js'
import paymentRoutes from './routes/payments.js'
import dashboardRoutes from './routes/dashboard.js'
import reportRoutes from './routes/reports.js'
import analyticsRoutes from './routes/analytics.js'
import { businessSettingsRouter, userSettingsRouter, permissionsRouter } from './routes/settings.js'
import referralRoutes from './routes/referral.js'
import taxCategoryRoutes from './routes/tax-categories.js'
import hsnRoutes from './routes/hsn.js'
import gstinRoutes from './routes/gstin.js'
import taxReportRoutes from './routes/tax-reports.js'
import gstReturnRoutes from './routes/gst-returns.js'
import gstSettingsRoutes from './routes/gst-settings.route.js'
import gstBackfillRoutes from './routes/gst-backfill.route.js'
import gstValidationRoutes from './routes/gst-validation.routes.js'
import tdsTcsRoutes from './routes/tds-tcs.js'
import einvoiceRoutes from './routes/einvoice.js'
import ewaybillRoutes from './routes/ewaybill.js'
import recurringRoutes from './routes/recurring/recurring.route.js'
import currencyRoutes from './routes/currency.js'
import reconciliationRoutes from './routes/reconciliation.js'
import bankReconciliationRoutes from './routes/bank-reconciliation.routes.js'
import accountingRoutes from './routes/accounting.js'
import bankRoutes from './routes/bank.js'
import expenseRoutes from './routes/expenses.js'
import otherIncomeRoutes from './routes/other-income.js'
import cashEntriesRoutes from './routes/cash-entries.route.js'
import chequeRoutes from './routes/cheques.js'
import financialReportRoutes from './routes/financial-reports.js'
import loanRoutes from './routes/loans.js'
import fyClosureRoutes from './routes/fy-closure.js'
import couponRoutes from './routes/coupons.js'
import biometricRoutes from './routes/biometric.js'
import stockAlertRoutes from './routes/stock-alerts.js'
import reorderRoutes from './routes/reorder.routes.js'
import stockVerificationRoutes from './routes/stock-verification.js'
import batchRoutes from './routes/batches.js'
import godownRoutes from './routes/godowns.js'
import serialNumberRoutes from './routes/serial-numbers.js'
import razorpayRoutes from './routes/razorpay.js'
import adminRoutes from './routes/admin/index.js'
import recycleBinRoutes from './routes/recycle-bin.js'
import eventRoutes from './routes/events.js'
import presenceRoutes from './routes/presence.routes.js'
import collectionsAgingRoutes from './routes/collections/aging.route.js'
import collectionsPtpRoutes from './routes/collections/ptp.route.js'
import collectionsStatementRoutes from './routes/collections/statement.route.js'
import paymentLinksRoutes from './routes/payments/payment-links.route.js'
import remindersRoute from './routes/payments/reminders.route.js'
import sessionRoutes from './routes/sessions.js'
import exportRoutes from './routes/export.js'
import { subscriptionRouter } from './routes/subscription.js'
import { mandateRouter } from './routes/subscription/mandate.routes.js'
import { subscriptionsAdminRouter } from './routes/admin/subscriptions.admin.js'
import { entitlementPubkeyRouter } from './routes/auth/entitlement-pubkey.route.js'
import jobRoutes from './routes/jobs.js'
import customOrderRoutes from './routes/custom-orders.js'
import notificationsRoutes from './routes/notifications.js'
import posRoutes from './routes/pos.js'
import bomRoutes from './routes/bom.js'
import recipeCostRoutes from './routes/recipe-cost.js'
import productionRunRoutes from './routes/production-runs.js'
import marketingRoutes from './routes/marketing.js'
import priceListRoutes from './routes/price-lists.routes.js'
import priceListEntriesRoutes from './routes/price-list-entries.routes.js'
import { assignRouter as priceListAssignRoutes } from './routes/price-list-assign.routes.js'
import storefrontRoutes from './routes/storefront.routes.js'
import loyaltyRoutes from './routes/loyalty.routes.js'
import commissionRoutes from './routes/commission.routes.js'
import businessesPhase6Routes from './routes/businesses.routes.js'
import authPinRoutes from './routes/auth-pin.routes.js'
import auditRoutes from './routes/audit.routes.js'
import hrRoutes from './routes/hr.routes.js'
import payrollRoutes from './routes/payroll.routes.js'
import importsRoutes from './routes/imports/index.js'

const ROUTE_MOUNTS: Array<[string, Router]> = [
  ['/api/imports', importsRoutes],
  ['/api/auth', authRoutes],
  ['/api/auth/biometric', biometricRoutes],
  ['/api/feedback', feedbackRoutes],
  ['/api/backup', backupRoutes],
  ['/api/parties', partyRoutes],
  ['/api/party-groups', partyGroupRoutes],
  ['/api/custom-fields', customFieldRoutes],
  ['/api/products', productRoutes],
  ['/api/categories', categoryRoutes],
  ['/api/units', unitRoutes],
  ['/api/settings/inventory', inventorySettingsRoutes],
  ['/api/documents', documentRoutes],
  ['/api/jobs', jobRoutes],
  ['/api/custom-orders', customOrderRoutes],
  ['/api/settings/documents', documentSettingsRoutes],
  ['/api/payments/payment-links', paymentLinksRoutes],
  ['/api/payments/reminders', remindersRoute],
  ['/api/payments', paymentRoutes],
  ['/api/dashboard', dashboardRoutes],
  ['/api/analytics', analyticsRoutes],
  ['/api/reports', reportRoutes],
  ['/api/businesses', businessSettingsRouter],
  ['/api/businesses', subscriptionRouter],
  ['/api/subscription/mandate', mandateRouter],
  ['/api/subscription', subscriptionRouter],
  ['/api/admin/subscriptions', subscriptionsAdminRouter],
  ['/api/auth/entitlement-pubkey', entitlementPubkeyRouter],
  ['/api/users', userSettingsRouter],
  ['/api/permissions', permissionsRouter],
  ['/api/referral', referralRoutes],
  ['/api/tax-categories', taxCategoryRoutes],
  ['/api/hsn', hsnRoutes],
  ['/api/gstin', gstinRoutes],
  ['/api/reports', taxReportRoutes],
  ['/api/gst/settings', gstSettingsRoutes],
  ['/api/gst/returns', gstReturnRoutes],
  ['/api/gst/backfill', gstBackfillRoutes],
  ['/api/gst/filing-readiness', gstValidationRoutes],
  ['/api/gst/reconciliation', reconciliationRoutes],
  ['/api/bank-reconciliation', bankReconciliationRoutes],
  ['/api/reports', tdsTcsRoutes],
  ['/api/einvoice', einvoiceRoutes],
  ['/api/ewaybill', ewaybillRoutes],
  ['/api/recurring', recurringRoutes],
  ['/api/currency', currencyRoutes],
  ['/api/coupons', couponRoutes],
  ['/api/stock-alerts', stockAlertRoutes],
  ['/api/inventory/reorder-suggestions', reorderRoutes],
  ['/api/stock-verification', stockVerificationRoutes],
  ['/api/batches', batchRoutes],
  ['/api/products', batchRoutes],
  ['/api/godowns', godownRoutes],
  ['/api/serial-numbers', serialNumberRoutes],
  ['/api/razorpay', razorpayRoutes],
  ['/api/accounting', accountingRoutes],
  ['/api/bank-accounts', bankRoutes],
  ['/api/cash-entries', cashEntriesRoutes],
  ['/api/expenses', expenseRoutes],
  ['/api/other-income', otherIncomeRoutes],
  ['/api/cheques', chequeRoutes],
  ['/api/reports/financial', financialReportRoutes],
  ['/api/loans', loanRoutes],
  ['/api/fy-closure', fyClosureRoutes],
  ['/api/admin', adminRoutes],
  ['/api/recycle-bin', recycleBinRoutes],
  ['/api/events', eventRoutes],
  ['/api/presence', presenceRoutes],
  ['/api/sessions', sessionRoutes],
  ['/api/export', exportRoutes],
  ['/api/collections/aging', collectionsAgingRoutes],
  ['/api/collections/ptp', collectionsPtpRoutes],
  ['/api/collections/statement', collectionsStatementRoutes],
  ['/api/notifications', notificationsRoutes],
  ['/api/pos', posRoutes],
  ['/api/bom', bomRoutes],
  ['/api/recipe-cost', recipeCostRoutes],
  ['/api/production-runs', productionRunRoutes],
  ['/api/marketing', marketingRoutes],
  ['/api/price-lists', priceListRoutes],
  ['/api/price-lists/:id/entries', priceListEntriesRoutes],
  ['/api/price-lists/:id/bulk-assign-parties', priceListAssignRoutes],

  // Epic C PR4 — Online Storefront (#121)
  ['/api/businesses/me/storefront', storefrontRoutes],

  // Epic D PR3 — Loyalty #125
  ['/api/loyalty', loyaltyRoutes],

  // Epic D PR5 — Commission #128
  ['/api/commission', commissionRoutes],

  // Phase 6 #138 PR2 — firm suspend/reactivate (architecture §3.5).
  // Mounts AFTER the existing businessSettingsRouter (line ~99 above) — both
  // routers live under /api/businesses and Express dispatches by path.
  ['/api/businesses', businessesPhase6Routes],

  // Phase 6 PR3 — PIN verify + OTP-gated reset (architecture §18.4 row 79).
  // Path overlaps `/api/auth` (authRoutes) — Express dispatches by sub-path,
  // so /api/auth/pin/* lands on this router; /api/auth/login etc. on authRoutes.
  ['/api/auth/pin', authPinRoutes],

  // Phase 6 PR4 — Audit search + redaction (architecture §18.5 rows 106-109).
  // Feature-gated inside the router via requireFeature('STAFF_HR') after auth.
  ['/api/audit', auditRoutes],

  // Phase 6 PR5 — HR / Attendance (architecture §4.1 + §18.6 rows 131-133).
  // Feature-gated inside the router via requireFeature('STAFF_HR') after auth.
  ['/api/hr', hrRoutes],

  // Phase 6 PR6 — Payroll (architecture §6.1 + §8 + §18.7 rows 149-151).
  // Feature-gated inside the router via requireFeature('STAFF_HR') after auth.
  ['/api/payroll', payrollRoutes],
]

export function mountFeatureRoutes(app: Express): void {
  for (const [path, router] of ROUTE_MOUNTS) app.use(path, router)
}
