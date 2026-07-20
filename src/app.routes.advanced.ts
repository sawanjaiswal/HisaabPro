/** Lazy-loaded page imports — later phases.
 *
 * Split out of app.routes.ts (which hit the 250-line limit). Same contract:
 * one lazy export per route, re-exported by app.routes.ts.
 */

import { lazy } from 'react'

// Phase 4 — Advanced Inventory
export const Batches = lazy(() => import('@/features/batches/BatchesPage'))
export const CreateBatch = lazy(() => import('@/features/batches/CreateBatchPage'))
export const BatchDetail = lazy(() => import('@/features/batches/BatchDetailPage'))
export const Godowns = lazy(() => import('@/features/godowns/GodownsPage'))
export const CreateGodown = lazy(() => import('@/features/godowns/CreateGodownPage'))
export const EditGodown = lazy(() => import('@/features/godowns/EditGodownPage'))
export const GodownDetail = lazy(() => import('@/features/godowns/GodownDetailPage'))
export const GodownTransfer = lazy(() => import('@/features/godowns/TransferPage'))
export const StockVerifications = lazy(() => import('@/features/stock-verification/VerificationsPage'))
export const VerificationDetail = lazy(() => import('@/features/stock-verification/VerificationDetailPage'))
export const Serials = lazy(() => import('@/features/serial-numbers/SerialsPage'))
export const CreateSerial = lazy(() => import('@/features/serial-numbers/CreateSerialPage'))
export const BulkCreateSerial = lazy(() => import('@/features/serial-numbers/BulkCreateSerialPage'))
export const SerialLookup = lazy(() => import('@/features/serial-numbers/SerialLookupPage'))
export const Pos = lazy(() => import('@/features/pos/PosPage'))
export const PosMain = lazy(() => import('@/features/pos/pages/PosPage'))
export const PosHistory = lazy(() => import('@/features/pos/pages/PosHistoryPage'))
export const PosSaleDetail = lazy(() => import('@/features/pos/pages/PosSaleDetailPage'))

export const StaffPermissions = lazy(() => import('@/features/settings/StaffPermissionsPage'))
export const InventorySettings = lazy(() => import('@/features/settings/InventorySettingsPage'))
export const LoyaltyProgramPage = lazy(() => import('@/features/loyalty/pages/LoyaltyProgramPage'))
// Epic D #128 — Commission frontend (rules + ledger + leaderboard)
export const CommissionSettings = lazy(() => import('@/features/commission/pages/CommissionSettingsPage'))
export const CommissionLedger = lazy(() => import('@/features/commission/pages/CommissionLedgerPage'))
export const CommissionLeaderboard = lazy(() => import('@/features/commission/pages/LeaderboardPage'))
export const DocumentSettings = lazy(() => import('@/features/settings/DocumentSettingsPage'))
export const DocumentCustomFields = lazy(() => import('@/features/settings/DocumentCustomFieldsPage'))

// Inventory Phase 2 — Purchase + Alerts
export const Purchases = lazy(() => import('@/features/purchases/PurchasesPage'))
export const CreatePurchase = lazy(() => import('@/features/purchases/CreatePurchasePage'))
export const ReturnsList = lazy(() => import('@/features/returns/ReturnsListPage'))
export const StockAlerts = lazy(() => import('@/features/products/StockAlertsPage'))

// Inventory Phase 2 — Stock verification mobile flow + value report (INV-07)
export const StockVerificationStart = lazy(() => import('@/features/stock-verification/pages/StockVerificationStartPage'))
export const StockVerificationRun = lazy(() => import('@/features/stock-verification/pages/StockVerificationRunPage'))
export const StockValueReport = lazy(() => import('@/features/reports/StockValueReportPage'))

// Phase 3 — Jobs
export const Jobs = lazy(() => import('@/features/jobs/pages/JobsListPage'))
export const JobNew = lazy(() => import('@/features/jobs/pages/JobNewPage'))
export const JobDetail = lazy(() => import('@/features/jobs/pages/JobDetailPage'))
export const JobEdit = lazy(() => import('@/features/jobs/pages/JobEditPage'))

// Phase 4 — Custom Orders (bakery / tailor vertical)
export const CustomOrders = lazy(() => import('@/features/custom-orders/pages/CustomOrdersListPage'))
export const CustomOrderNew = lazy(() => import('@/features/custom-orders/pages/CustomOrderNewPage'))
export const CustomOrderDetail = lazy(() => import('@/features/custom-orders/pages/CustomOrderDetailPage'))
export const CustomOrderEdit = lazy(() => import('@/features/custom-orders/pages/CustomOrderEditPage'))

export const NotFound = lazy(() => import('@/components/feedback/NotFoundPage'))

// GST Phase 2 — Backfill Wizard
export const BackfillWizard = lazy(() => import('@/features/gst-returns/BackfillWizardPage'))

// GST Phase 2 — GSTR-1 Export (PR 10)
export const Gstr1Page = lazy(() => import('@/features/gst-returns/Gstr1Page'))

// GST Phase 2 — GSTR-3B Summary (PR 11)
export const Gstr3bPage = lazy(() => import('@/features/gst-returns/Gstr3bPage'))

// Payments Hub PR 3 — Collections / Aging Dashboard
export const AgingDashboardPage = lazy(() => import('@/features/collections/pages/AgingDashboard'))
export const AgingBucketListPage = lazy(() => import('@/features/collections/pages/AgingBucketList'))

// Cash Register (PR 4)
export const CashRegister = lazy(() => import('@/features/cash-register/components/CashRegisterPage'))

// Notifications Engine (PR12+PR13)
export const Notifications = lazy(() => import('@/features/notifications/pages/NotificationsPage'))
export const NotificationPreferences = lazy(() => import('@/features/notifications/pages/NotificationPreferencesPage'))

// Phase 4 — BOM / Manufacturing (PR4-PR6)
export const BomList = lazy(() => import('@/features/bom/pages/BomListPage'))
export const BomForm = lazy(() => import('@/features/bom/pages/BomFormPage'))
export const BomDetail = lazy(() => import('@/features/bom/pages/BomDetailPage'))
export const RecipeCost = lazy(() => import('@/features/recipe-cost/RecipeCostPage'))
export const ProductionRunList = lazy(() => import('@/features/production-runs/pages/ProductionRunListPage'))
export const ProductionRunForm = lazy(() => import('@/features/production-runs/pages/ProductionRunFormPage'))
export const ProductionRunDetail = lazy(() => import('@/features/production-runs/pages/ProductionRunDetailPage'))

// Phase 5 Epic D #127 — CRM Basics
export const FollowUps = lazy(() => import('@/features/crm/pages/FollowUpsPage'))

// Phase 5 Epic A — Marketing Comms
export const MarketingHub = lazy(() => import('@/features/marketing/pages/MarketingHubPage'))
export const MarketingTemplateList = lazy(() => import('@/features/marketing/pages/TemplateListPage'))
export const MarketingTemplateForm = lazy(() => import('@/features/marketing/pages/TemplateFormPage'))
export const MarketingCampaignList = lazy(() => import('@/features/marketing/pages/CampaignListPage'))
export const MarketingCampaignWizard = lazy(() => import('@/features/marketing/pages/CampaignWizardPage'))
export const MarketingCampaignDetail = lazy(() => import('@/features/marketing/pages/CampaignDetailPage'))
export const MarketingReminderList = lazy(() => import('@/features/marketing/pages/ReminderRuleListPage'))
export const MarketingReminderForm = lazy(() => import('@/features/marketing/pages/ReminderRuleFormPage'))
export const MarketingOptOuts = lazy(() => import('@/features/marketing/pages/OptOutListPage'))

// #132 — Price Lists (Batch 4)
export const PriceLists = lazy(() => import('@/features/price-lists/PriceListsPage'))
export const PriceListDetail = lazy(() => import('@/features/price-lists/PriceListDetailPage'))

// Epic C PR4 — Online Storefront (#121)
export const StorefrontSettings = lazy(() => import('@/features/storefront/StorefrontSettingsPage'))
export const PublicStorePage = lazy(() =>
  import('@/pages/public/PublicStorePage').then(m => ({ default: m.PublicStorePage }))
)

// Epic C PR5 — Party Invite-Claim (#131)
export const PublicInvitePage = lazy(() =>
  import('@/pages/public/PublicInvitePage').then(m => ({ default: m.PublicInvitePage }))
)

// Phase 6 — Staff & HR (PR5 FE — Attendance daily grid)
export const Attendance = lazy(() => import('@/features/hr/AttendancePage'))

// Phase 6 — Staff & HR (PR6 FE — Employees + Payroll + Payslip)
export const Employees = lazy(() => import('@/features/hr/EmployeeListPage'))
export const EmployeeDetail = lazy(() => import('@/features/hr/EmployeeDetailPage'))
export const Payroll = lazy(() => import('@/features/hr/PayrollPage'))
export const PayrollWizard = lazy(() => import('@/features/hr/PayrollWizardPage'))
export const PayrollRunDetail = lazy(() => import('@/features/hr/PayrollRunDetailPage'))
export const Payslip = lazy(() => import('@/features/hr/PayslipPage'))

// Phase 5 Epic B — Sales Pipeline (#122)
export const SalesHub = lazy(() => import('@/features/sales/SalesHubPage'))
export const EstimateDetail = lazy(() => import('@/features/sales/EstimateDetailPage'))
export const SaleOrderDetail = lazy(() => import('@/features/sales/SaleOrderDetailPage'))
export const ChallanDetail = lazy(() => import('@/features/sales/ChallanDetailPage'))
// Thin entry-point wrappers for create routes — each file passes `type` to CreateInvoicePage
export const CreateEstimate = lazy(() => import('@/features/sales/create/CreateEstimatePage'))
export const CreateSaleOrder = lazy(() => import('@/features/sales/create/CreateSaleOrderPage'))
export const CreateChallan = lazy(() => import('@/features/sales/create/CreateChallanPage'))
// V2 Appointments FE-1 (FEATURES.V2_APPOINTMENTS gates BottomNav entry).
export const Appointments = lazy(() => import('@/features/appointments/pages/AppointmentsPage'))
export const AppointmentDetail = lazy(() => import('@/features/appointments/pages/AppointmentDetailPage'))
