import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicLayoutRoute, PublicHealthPage, PublicInvoicePage } from '@/pages/public'
import { ROUTES } from '@/config/routes.config'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { ToastContainer } from '@/components/feedback/ToastContainer'
import { OfflineBanner } from '@/components/feedback/OfflineBanner'
import { SideNav } from '@/components/layout/SideNav'
import { SWUpdatePrompt } from '@/components/feedback/SWUpdatePrompt'
import { PageTransition } from '@/components/layout/PageTransition'
import { useRoutePreload } from '@/hooks/useRoutePreload'
import { useSSE } from '@/hooks/useSSE'
import { PlanGate } from '@/features/subscription/PlanGate'
import {
  Login, Register, VerifyOtp, ForgotPassword, Onboarding, Dashboard,
  Parties, CreateParty, PartyDetail, EditParty, FollowUps,
  Products, CreateProduct, Categories, StockAdjustments, ProductDetail, EditProduct,
  Invoices, CreateInvoice, InvoiceDetail, EditInvoice,
  TemplateGallery, TemplateEditor,
  Payments, RecordPayment, PaymentDetail, EditPayment, Outstanding,
  ReportsHub, SaleReport, PurchaseReport, PartyStatement, StockSummary,
  DayBook, PaymentHistory, TaxSummary, GstReturns, TdsTcsReport,
  Settings, SubscriptionManage, SubscriptionCheckout, Roles, RoleBuilder, Staff, StaffInvite, StaffPermissions,
  TransactionControls, AuditLog, ActiveSessions, PinSetup, Shortcuts, ThemeAppearance, BackupSettings,
  GstSettings, TaxCategories, CreateTaxCategory, EditTaxCategory,
  CurrencySettings, RecurringList, RecurringDetail, RecurringForm,
  GstReconciliationList, GstReconciliationDetail,
  ChartOfAccounts, JournalEntries, TrialBalance,
  BankAccounts, BankReconciliation, Expenses, OtherIncome, VoiceEntry, Cheques, Loans, LoanDetail,
  ExpensesPending, ExpensesBudgets, ExpensesRecurring, ExpenseCategories, ExpenseDetail,
  ProfitLoss, BalanceSheet, CashFlow, AgingReport, ProfitabilityReport,
  DiscountReport, PredictiveAnalytics, ReorderSuggestions, GstFilingReadiness, TallyExport, FYClosure,
  More, BillScan, BulkImport, PublicLedger, ItemsLibrary, ImportUpload, ImportJobStub,
  SmartGreetings, Units, JoinBusiness, CreateBusiness, BusinessType,
  AdminCoupons, AdminCouponDetail,
  Purchases, CreatePurchase, ReturnsList, StockAlerts,
  StockVerificationStart, StockVerificationRun, StockValueReport,
  Batches, CreateBatch, BatchDetail,
  Godowns, CreateGodown, EditGodown, GodownDetail, GodownTransfer,
  StockVerifications, VerificationDetail,
  Serials, CreateSerial, BulkCreateSerial, SerialLookup, Pos,
  PosMain, PosHistory, PosSaleDetail,
  Jobs, JobNew, JobDetail, JobEdit, InventorySettings, LoyaltyProgramPage, CommissionSettings, CommissionLedger, CommissionLeaderboard, DocumentSettings, DocumentCustomFields,
  CustomOrders, CustomOrderNew, CustomOrderDetail, CustomOrderEdit,
  BackfillWizard, Gstr1Page, Gstr3bPage, AgingDashboardPage, AgingBucketListPage,
  CashRegister, Notifications, NotificationPreferences,
  BomList, BomForm, BomDetail, RecipeCost,
  ProductionRunList, ProductionRunForm, ProductionRunDetail,
  MarketingHub, MarketingTemplateList, MarketingTemplateForm, MarketingCampaignList, MarketingCampaignWizard, MarketingCampaignDetail, MarketingReminderList, MarketingReminderForm, MarketingOptOuts,
  PriceLists, PriceListDetail, NotFound,
  StorefrontSettings, PublicStorePage,
  PublicInvitePage,
  // Phase 5 Epic B — Sales Pipeline
  SalesHub,
  EstimateDetail, SaleOrderDetail, ChallanDetail,
  CreateEstimate, CreateSaleOrder, CreateChallan,
  // Phase 6 — Staff & HR (PR5 FE)
  Attendance,
  // Phase 6 — Staff & HR (PR6 FE — Employees + Payroll + Payslip)
  Employees, EmployeeDetail, Payroll, PayrollWizard, PayrollRunDetail, Payslip,
  // V2 Appointments (FE-1)
  Appointments, AppointmentDetail,
} from '@/app.routes'
import {
  PageRoute, DashboardFallback, ProtectedRoute, GuestRoute,
  HomeGate, PersistentNav, FloatingWidgets, EdgeSwipeBack,
} from '@/app.guards'

export function App() {
  useRoutePreload()
  useSSE()

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <PageTransition>
      <Routes>
        <Route element={<PublicLayoutRoute />}>
          <Route path="/p/health" element={<PublicHealthPage />} />
          <Route path="/p/invoice/:token" element={<PublicInvoicePage />} />
          <Route path="/p/store/:slug" element={<PageRoute><PublicStorePage /></PageRoute>} />
          <Route path="/p/invite/:token" element={<PageRoute><PublicInvitePage /></PageRoute>} />
        </Route>
        <Route path={ROUTES.HOME} element={<ErrorBoundary><PageRoute><HomeGate /></PageRoute></ErrorBoundary>} />
        <Route path={ROUTES.PRICING} element={<Navigate to="/#pricing" replace />} />
        <Route path={ROUTES.LOGIN} element={<PageRoute><GuestRoute><Login /></GuestRoute></PageRoute>} />
        <Route path={ROUTES.REGISTER} element={<PageRoute><GuestRoute><Register /></GuestRoute></PageRoute>} />
        <Route path={ROUTES.VERIFY_OTP} element={<PageRoute><VerifyOtp /></PageRoute>} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<PageRoute><GuestRoute><ForgotPassword /></GuestRoute></PageRoute>} />
        <Route path={ROUTES.ONBOARDING} element={<PageRoute><ProtectedRoute><Onboarding /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.DASHBOARD} element={<PageRoute fallback={<DashboardFallback />}><ProtectedRoute><Dashboard /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTIES} element={<PageRoute><ProtectedRoute><PlanGate feature="parties" featureLabel="Parties"><Parties /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTY_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="parties" featureLabel="Parties"><CreateParty /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTY_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="parties" featureLabel="Parties"><PartyDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTY_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="parties" featureLabel="Parties"><EditParty /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CRM_FOLLOWUPS} element={<PageRoute><ProtectedRoute><PlanGate feature="parties" featureLabel="Parties"><FollowUps /></PlanGate></ProtectedRoute></PageRoute>} />

        {/* V2 Appointments (FE-1) — server gates per-tenant via requireFeature('V2_APPOINTMENTS') */}
        <Route path={ROUTES.APPOINTMENTS} element={<PageRoute><ProtectedRoute><Appointments /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.APPOINTMENT_DETAIL} element={<PageRoute><ProtectedRoute><AppointmentDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCTS} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Products"><Products /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCT_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Products"><CreateProduct /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCT_CATEGORIES} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Products"><Categories /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.STOCK_ADJUSTMENTS} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Products"><StockAdjustments /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCT_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Products"><ProductDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCT_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Products"><EditProduct /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICES} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Invoices"><Invoices /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICE_CREATE} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Invoices"><CreateInvoice /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICE_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Invoices"><InvoiceDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICE_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Invoices"><EditInvoice /></PlanGate></ProtectedRoute></PageRoute>} />

        {/* Phase 5 Epic B — Sales Pipeline (#122) */}
        <Route path={ROUTES.SALES} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Sales"><SalesHub /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ESTIMATES} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Estimates"><SalesHub /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ESTIMATE_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Estimates"><CreateEstimate /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ESTIMATE_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Estimates"><EstimateDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SALE_ORDERS} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Sale Orders"><SalesHub /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SALE_ORDER_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Sale Orders"><CreateSaleOrder /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SALE_ORDER_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Sale Orders"><SaleOrderDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.DELIVERY_CHALLANS} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Delivery Challans"><SalesHub /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.DELIVERY_CHALLAN_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Delivery Challans"><CreateChallan /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.DELIVERY_CHALLAN_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Delivery Challans"><ChallanDetail /></PlanGate></ProtectedRoute></PageRoute>} />

        <Route path={ROUTES.TEMPLATES} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Invoice Templates"><TemplateGallery /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.TEMPLATE_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Invoice Templates"><TemplateEditor /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYMENTS} element={<PageRoute><ProtectedRoute><PlanGate feature="payments" featureLabel="Payments"><Payments /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYMENT_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="payments" featureLabel="Payments"><RecordPayment /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path="/payments/outstanding" element={<Navigate to={ROUTES.OUTSTANDING} replace />} />
        <Route path={ROUTES.PAYMENT_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="payments" featureLabel="Payments"><PaymentDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYMENT_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="payments" featureLabel="Payments"><EditPayment /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.OUTSTANDING} element={<PageRoute><ProtectedRoute><PlanGate feature="payments" featureLabel="Outstanding"><Outstanding /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORTS} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Reports"><ReportsHub /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_SALES} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Sales Report"><SaleReport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PURCHASES} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Purchase Report"><PurchaseReport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PARTY_STATEMENT} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Party Statement"><PartyStatement /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_STOCK_SUMMARY} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Stock Summary"><StockSummary /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_DAY_BOOK} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Day Book"><DayBook /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PAYMENT_HISTORY} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Payment History"><PaymentHistory /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_TAX_SUMMARY} element={<PageRoute><ProtectedRoute><PlanGate feature="taxReports" featureLabel="Tax Summary"><TaxSummary /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_GST_RETURNS} element={<PageRoute><ProtectedRoute><PlanGate feature="taxReports" featureLabel="GST Returns"><GstReturns /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_TDS_TCS} element={<PageRoute><ProtectedRoute><PlanGate feature="taxReports" featureLabel="TDS/TCS Report"><TdsTcsReport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS} element={<PageRoute><ProtectedRoute><Settings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_ROLES} element={<PageRoute><ProtectedRoute><Roles /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_ROLE_NEW} element={<PageRoute><ProtectedRoute><RoleBuilder /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_ROLE_EDIT} element={<PageRoute><ProtectedRoute><RoleBuilder /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_STAFF} element={<PageRoute><ProtectedRoute><Staff /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_STAFF_INVITE} element={<PageRoute><ProtectedRoute><StaffInvite /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_PERMISSIONS} element={<PageRoute><ProtectedRoute><StaffPermissions /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SECURITY} element={<PageRoute><ProtectedRoute><PinSetup /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TRANSACTION_CONTROLS} element={<PageRoute><ProtectedRoute><TransactionControls /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_AUDIT_LOG} element={<PageRoute><ProtectedRoute><AuditLog /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SESSIONS} element={<PageRoute><ProtectedRoute><ActiveSessions /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SHORTCUTS} element={<PageRoute><ProtectedRoute><Shortcuts /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_THEME} element={<PageRoute><ProtectedRoute><ThemeAppearance /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_BACKUP} element={<PageRoute><ProtectedRoute><BackupSettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_PIN_SETUP} element={<PageRoute><ProtectedRoute><PinSetup /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SUBSCRIPTION} element={<PageRoute><ProtectedRoute><SubscriptionManage /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SUBSCRIPTION_CHECKOUT} element={<PageRoute><ProtectedRoute><SubscriptionCheckout /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_GST} element={<PageRoute><ProtectedRoute><GstSettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TAX_RATES} element={<PageRoute><ProtectedRoute><TaxCategories /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TAX_RATE_NEW} element={<PageRoute><ProtectedRoute><CreateTaxCategory /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TAX_RATE_EDIT} element={<PageRoute><ProtectedRoute><EditTaxCategory /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_CURRENCY} element={<PageRoute><ProtectedRoute><CurrencySettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_UNITS} element={<PageRoute><ProtectedRoute><Units /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_INVENTORY} element={<PageRoute><ProtectedRoute><InventorySettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_LOYALTY} element={<PageRoute><ProtectedRoute><LoyaltyProgramPage /></ProtectedRoute></PageRoute>} />
        {/* Epic D #128 — Commission frontend */}
        <Route path={ROUTES.SETTINGS_COMMISSION} element={<PageRoute><ProtectedRoute><CommissionSettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.COMMISSION_LEDGER} element={<PageRoute><ProtectedRoute><CommissionLedger /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.COMMISSION_LEADERBOARD} element={<PageRoute><ProtectedRoute><CommissionLeaderboard /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_DOCUMENTS} element={<PageRoute><ProtectedRoute><DocumentSettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_DOC_CUSTOM_FIELDS} element={<PageRoute><ProtectedRoute><DocumentCustomFields /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.RECURRING} element={<PageRoute><ProtectedRoute><PlanGate feature="recurringInvoices" featureLabel="Recurring Invoices"><RecurringList /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.RECURRING_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="recurringInvoices" featureLabel="Recurring Invoices"><RecurringForm /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.RECURRING_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="recurringInvoices" featureLabel="Recurring Invoices"><RecurringForm /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.RECURRING_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="recurringInvoices" featureLabel="Recurring Invoices"><RecurringDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_RECONCILIATION} element={<PageRoute><ProtectedRoute><GstReconciliationList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_RECONCILIATION_DETAIL} element={<PageRoute><ProtectedRoute><GstReconciliationDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_BACKFILL} element={<PageRoute><ProtectedRoute><BackfillWizard /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_GSTR1} element={<PageRoute><ProtectedRoute><Gstr1Page /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_GSTR3B} element={<PageRoute><ProtectedRoute><Gstr3bPage /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CHART_OF_ACCOUNTS} element={<PageRoute><ProtectedRoute><PlanGate feature="accounting" featureLabel="Chart of Accounts"><ChartOfAccounts /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.JOURNAL_ENTRIES} element={<PageRoute><ProtectedRoute><PlanGate feature="accounting" featureLabel="Journal Entries"><JournalEntries /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.TRIAL_BALANCE} element={<PageRoute><ProtectedRoute><PlanGate feature="accounting" featureLabel="Trial Balance"><TrialBalance /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BANK_ACCOUNTS} element={<PageRoute><ProtectedRoute><PlanGate feature="bankAccounts" featureLabel="Bank Accounts"><BankAccounts /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.EXPENSES} element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Expenses"><Expenses /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.EXPENSE_CATEGORIES} element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Expenses"><ExpenseCategories /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path="/expenses/pending" element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Expenses"><ExpensesPending /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path="/expenses/budgets" element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Expenses"><ExpensesBudgets /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path="/expenses/recurring" element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Expenses"><ExpensesRecurring /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.EXPENSE_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Expenses"><ExpenseDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.OTHER_INCOME} element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Other Income"><OtherIncome /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.VOICE_ENTRY} element={<PageRoute><ProtectedRoute><PlanGate feature="expenses" featureLabel="Voice Entry"><VoiceEntry /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CHEQUES} element={<PageRoute><ProtectedRoute><PlanGate feature="cheques" featureLabel="Cheques"><Cheques /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BANK_RECONCILIATION} element={<PageRoute><ProtectedRoute><PlanGate feature="accounting" featureLabel="Bank Reconciliation"><BankReconciliation /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.LOANS} element={<PageRoute><ProtectedRoute><Loans /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.LOAN_DETAIL} element={<PageRoute><ProtectedRoute><LoanDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PROFIT_LOSS} element={<PageRoute><ProtectedRoute><PlanGate feature="advancedReports" featureLabel="Profit & Loss"><ProfitLoss /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_BALANCE_SHEET} element={<PageRoute><ProtectedRoute><PlanGate feature="advancedReports" featureLabel="Balance Sheet"><BalanceSheet /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_CASH_FLOW} element={<PageRoute><ProtectedRoute><PlanGate feature="advancedReports" featureLabel="Cash Flow"><CashFlow /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_AGING} element={<PageRoute><ProtectedRoute><PlanGate feature="advancedReports" featureLabel="Aging Report"><AgingReport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PROFITABILITY} element={<PageRoute><ProtectedRoute><PlanGate feature="advancedReports" featureLabel="Profitability Report"><ProfitabilityReport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_DISCOUNTS} element={<PageRoute><ProtectedRoute><PlanGate feature="advancedReports" featureLabel="Discount Report"><DiscountReport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INSIGHTS} element={<PageRoute><ProtectedRoute><PlanGate feature="advancedReports" featureLabel="Insights"><PredictiveAnalytics /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.TALLY_EXPORT} element={<PageRoute><ProtectedRoute><PlanGate feature="tallyExport" featureLabel="Tally Export"><TallyExport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.FY_CLOSURE} element={<PageRoute><ProtectedRoute><FYClosure /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BILL_SCAN} element={<PageRoute><ProtectedRoute><BillScan /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BULK_IMPORT_PARTIES} element={<PageRoute><ProtectedRoute><PlanGate feature="bulkImport" featureLabel="Bulk Import"><BulkImport /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MORE} element={<PageRoute><ProtectedRoute><More /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ITEMS_LIBRARY} element={<PageRoute><ProtectedRoute><ItemsLibrary /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.DATA_IMPORT} element={<Navigate to={ROUTES.IMPORTS} replace />} />
        <Route path={ROUTES.IMPORTS} element={<PageRoute><ProtectedRoute><ImportUpload /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.IMPORT_JOB_DETAIL} element={<PageRoute><ProtectedRoute><ImportJobStub /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SMART_GREETINGS} element={<PageRoute><ProtectedRoute><SmartGreetings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.JOIN_BUSINESS} element={<PageRoute><ProtectedRoute><JoinBusiness /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CREATE_BUSINESS} element={<PageRoute><ProtectedRoute><CreateBusiness /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BUSINESS_TYPE} element={<PageRoute><ProtectedRoute><BusinessType /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ADMIN_COUPONS} element={<PageRoute><ProtectedRoute><AdminCoupons /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ADMIN_COUPON_DETAIL} element={<PageRoute><ProtectedRoute><AdminCouponDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BATCH_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="batchTracking" featureLabel="Batch Tracking"><CreateBatch /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BATCHES} element={<PageRoute><ProtectedRoute><PlanGate feature="batchTracking" featureLabel="Batch Tracking"><Batches /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BATCH_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="batchTracking" featureLabel="Batch Tracking"><BatchDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="multiGodown" featureLabel="Multi-Godown"><CreateGodown /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="multiGodown" featureLabel="Multi-Godown"><EditGodown /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_TRANSFER} element={<PageRoute><ProtectedRoute><PlanGate feature="multiGodown" featureLabel="Multi-Godown"><GodownTransfer /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWNS} element={<PageRoute><ProtectedRoute><PlanGate feature="multiGodown" featureLabel="Multi-Godown"><Godowns /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="multiGodown" featureLabel="Multi-Godown"><GodownDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.STOCK_VERIFICATION} element={<PageRoute><ProtectedRoute><PlanGate feature="stockAdjustments" featureLabel="Stock Verification"><StockVerifications /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.STOCK_VERIFICATION_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="stockAdjustments" featureLabel="Stock Verification"><VerificationDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="serialTracking" featureLabel="Serial Numbers"><CreateSerial /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_BULK} element={<PageRoute><ProtectedRoute><PlanGate feature="serialTracking" featureLabel="Serial Numbers"><BulkCreateSerial /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_NUMBERS} element={<PageRoute><ProtectedRoute><PlanGate feature="serialTracking" featureLabel="Serial Numbers"><Serials /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_LOOKUP} element={<PageRoute><ProtectedRoute><PlanGate feature="serialTracking" featureLabel="Serial Numbers"><SerialLookup /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.POS} element={<PageRoute><ProtectedRoute><PlanGate feature="posMode" featureLabel="POS"><Pos /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path="/pos/billing" element={<PageRoute><ProtectedRoute><PlanGate feature="posMode" featureLabel="POS"><PosMain /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.POS_HISTORY} element={<PageRoute><ProtectedRoute><PlanGate feature="posMode" featureLabel="POS"><PosHistory /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.POS_SALE_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="posMode" featureLabel="POS"><PosSaleDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.JOBS}       element={<PageRoute><ProtectedRoute><Jobs /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.JOB_NEW}    element={<PageRoute><ProtectedRoute><JobNew /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.JOB_DETAIL} element={<PageRoute><ProtectedRoute><JobDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.JOB_EDIT}   element={<PageRoute><ProtectedRoute><JobEdit /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ORDERS}       element={<PageRoute><ProtectedRoute><CustomOrders /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ORDER_NEW}    element={<PageRoute><ProtectedRoute><CustomOrderNew /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ORDER_DETAIL} element={<PageRoute><ProtectedRoute><CustomOrderDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ORDER_EDIT}   element={<PageRoute><ProtectedRoute><CustomOrderEdit /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PUBLIC_LEDGER} element={<PageRoute><PublicLedger /></PageRoute>} />
        <Route path={ROUTES.COLLECTIONS} element={<PageRoute><ProtectedRoute><AgingDashboardPage /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.COLLECTIONS_BUCKET} element={<PageRoute><ProtectedRoute><AgingBucketListPage /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CASH_REGISTER} element={<PageRoute><ProtectedRoute><CashRegister /></ProtectedRoute></PageRoute>} />
        {/* Inventory Phase 2 */}
        <Route path={ROUTES.PURCHASES} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Purchases"><Purchases /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PURCHASE_NEW} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Purchases"><CreatePurchase /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PURCHASE_RETURNS} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Purchases"><ReturnsList type="DEBIT_NOTE" /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SALES_RETURNS} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Sales"><ReturnsList type="CREDIT_NOTE" /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PURCHASE_DETAIL} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Purchases"><InvoiceDetail /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PURCHASE_EDIT} element={<PageRoute><ProtectedRoute><PlanGate feature="invoicing" featureLabel="Purchases"><EditInvoice /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVENTORY_ALERTS} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Stock Alerts"><StockAlerts /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REORDER_SUGGESTIONS} element={<PageRoute><ProtectedRoute><PlanGate feature="products" featureLabel="Reorder Suggestions"><ReorderSuggestions /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_FILING_READINESS} element={<PageRoute><ProtectedRoute><PlanGate feature="taxReports" featureLabel="GST Filing Check"><GstFilingReadiness /></PlanGate></ProtectedRoute></PageRoute>} />
        {/* Inventory Phase 2 — INV-07: stock count flow + value report */}
        <Route path={ROUTES.INVENTORY_VERIFY} element={<PageRoute><ProtectedRoute><PlanGate feature="stockAdjustments" featureLabel="Stock Count"><StockVerificationStart /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVENTORY_VERIFY_RUN} element={<PageRoute><ProtectedRoute><PlanGate feature="stockAdjustments" featureLabel="Stock Count"><StockVerificationRun /></PlanGate></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.STOCK_VALUE_REPORT} element={<PageRoute><ProtectedRoute><PlanGate feature="basicReports" featureLabel="Stock Value Report"><StockValueReport /></PlanGate></ProtectedRoute></PageRoute>} />
        {/* Notifications Engine (PR12+PR13) */}
        <Route path={ROUTES.NOTIFICATIONS} element={<PageRoute><ProtectedRoute><Notifications /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.NOTIFICATION_PREFERENCES} element={<PageRoute><ProtectedRoute><NotificationPreferences /></ProtectedRoute></PageRoute>} />
        {/* Phase 4 — BOM / Manufacturing (PR4-PR6) */}
        <Route path={ROUTES.BOM} element={<PageRoute><ProtectedRoute><BomList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BOM_NEW} element={<PageRoute><ProtectedRoute><BomForm /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BOM_EDIT} element={<PageRoute><ProtectedRoute><BomForm /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BOM_DETAIL} element={<PageRoute><ProtectedRoute><BomDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.RECIPE_COST} element={<PageRoute><ProtectedRoute><RecipeCost /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCTION_RUNS} element={<PageRoute><ProtectedRoute><ProductionRunList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCTION_RUN_NEW} element={<PageRoute><ProtectedRoute><ProductionRunForm /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCTION_RUN_DETAIL} element={<PageRoute><ProtectedRoute><ProductionRunDetail /></ProtectedRoute></PageRoute>} />
        {/* Phase 5 Epic A — Marketing Comms */}
        <Route path={ROUTES.MARKETING_HUB} element={<PageRoute><ProtectedRoute><MarketingHub /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_TEMPLATES} element={<PageRoute><ProtectedRoute><MarketingTemplateList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_TEMPLATE_NEW} element={<PageRoute><ProtectedRoute><MarketingTemplateForm /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_TEMPLATE_EDIT} element={<PageRoute><ProtectedRoute><MarketingTemplateForm /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_CAMPAIGNS} element={<PageRoute><ProtectedRoute><MarketingCampaignList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_CAMPAIGN_NEW} element={<PageRoute><ProtectedRoute><MarketingCampaignWizard /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_CAMPAIGN_DETAIL} element={<PageRoute><ProtectedRoute><MarketingCampaignDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_REMINDERS} element={<PageRoute><ProtectedRoute><MarketingReminderList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_REMINDER_NEW} element={<PageRoute><ProtectedRoute><MarketingReminderForm /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_REMINDER_EDIT} element={<PageRoute><ProtectedRoute><MarketingReminderForm /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MARKETING_OPT_OUTS} element={<PageRoute><ProtectedRoute><MarketingOptOuts /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRICE_LISTS} element={<PageRoute><ProtectedRoute><PriceLists /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRICE_LIST_DETAIL} element={<PageRoute><ProtectedRoute><PriceListDetail /></ProtectedRoute></PageRoute>} />
        {/* Epic C PR4 — Online Storefront (#121) */}
        <Route path={ROUTES.STOREFRONT_SETTINGS} element={<PageRoute><ProtectedRoute><StorefrontSettings /></ProtectedRoute></PageRoute>} />
        {/* Phase 6 — Staff & HR (PR5 FE — Attendance daily grid) */}
        <Route path={ROUTES.HR_ATTENDANCE} element={<PageRoute><ProtectedRoute><Attendance /></ProtectedRoute></PageRoute>} />
        {/* Phase 6 — Staff & HR (PR6 FE — Employees + Payroll + Payslip) */}
        <Route path={ROUTES.HR_EMPLOYEES} element={<PageRoute><ProtectedRoute><Employees /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.HR_EMPLOYEE_DETAIL} element={<PageRoute><ProtectedRoute><EmployeeDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.HR_PAYROLL} element={<PageRoute><ProtectedRoute><Payroll /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.HR_PAYROLL_NEW} element={<PageRoute><ProtectedRoute><PayrollWizard /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.HR_PAYROLL_DETAIL} element={<PageRoute><ProtectedRoute><PayrollRunDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYSLIP} element={<PageRoute><ProtectedRoute><Payslip /></ProtectedRoute></PageRoute>} />
        <Route path="*" element={<PageRoute><NotFound /></PageRoute>} />
      </Routes>
      </PageTransition>
      <EdgeSwipeBack />
      <PersistentNav />
      <FloatingWidgets />
      <SideNav />
      <ToastContainer />
      <SWUpdatePrompt />
    </ErrorBoundary>
  )
}
