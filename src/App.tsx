import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { Spinner } from '@/components/feedback/Spinner'
import { ToastContainer } from '@/components/feedback/ToastContainer'
import { OfflineBanner } from '@/components/feedback/OfflineBanner'
import { SWUpdatePrompt } from '@/components/feedback/SWUpdatePrompt'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { PageTransition } from '@/components/layout/PageTransition'
import { useAuth } from '@/context/AuthContext'
import { useRoutePreload } from '@/hooks/useRoutePreload'
import { CalculatorOverlay } from '@/features/settings/CalculatorOverlay'

/** Lazy-loaded pages — split per route for small bundles */
const Login = lazy(() => import('@/features/auth/LoginPage'))
const Onboarding = lazy(() => import('@/features/onboarding/OnboardingPage'))
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'))
const Parties = lazy(() => import('@/features/parties/PartiesPage'))
const CreateParty = lazy(() => import('@/features/parties/CreatePartyPage'))
const PartyDetail = lazy(() => import('@/features/parties/PartyDetailPage'))
const Products = lazy(() => import('@/features/products/ProductsPage'))
const CreateProduct = lazy(() => import('@/features/products/CreateProductPage'))
const ProductDetail = lazy(() => import('@/features/products/ProductDetailPage'))
const Invoices = lazy(() => import('@/features/invoices/InvoicesPage'))
const CreateInvoice = lazy(() => import('@/features/invoices/CreateInvoicePage'))
const InvoiceDetail = lazy(() => import('@/features/invoices/InvoiceDetailPage'))
const EditParty = lazy(() => import('@/features/parties/EditPartyPage'))
const EditProduct = lazy(() => import('@/features/products/EditProductPage'))
const EditInvoice = lazy(() => import('@/features/invoices/EditInvoicePage'))
const TemplateGallery = lazy(() => import('@/features/templates/TemplateGalleryPage'))
const TemplateEditor = lazy(() => import('@/features/templates/TemplateEditorPage'))
const Payments = lazy(() => import('@/features/payments/PaymentsPage'))
const RecordPayment = lazy(() => import('@/features/payments/RecordPaymentPage'))
const PaymentDetail = lazy(() => import('@/features/payments/PaymentDetailPage'))
const EditPayment = lazy(() => import('@/features/payments/EditPaymentPage'))
const Outstanding = lazy(() => import('@/features/payments/OutstandingPage'))
const ReportsHub = lazy(() => import('@/features/reports/ReportsHubPage'))
const SaleReport = lazy(() => import('@/features/reports/InvoiceReportPage'))
const PurchaseReport = lazy(() => import('@/features/reports/InvoiceReportPage'))
const PartyStatement = lazy(() => import('@/features/reports/PartyStatementPage'))
const StockSummary = lazy(() => import('@/features/reports/StockSummaryPage'))
const DayBook = lazy(() => import('@/features/reports/DayBookPage'))
const PaymentHistory = lazy(() => import('@/features/reports/PaymentHistoryPage'))
const TaxSummary = lazy(() => import('@/features/reports/TaxSummaryPage'))
const GstReturns = lazy(() => import('@/features/reports/GstReturnsPage'))
const TdsTcsReport = lazy(() => import('@/features/reports/TdsTcsReportPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))
const Roles = lazy(() => import('@/features/settings/RolesPage'))
const RoleBuilder = lazy(() => import('@/features/settings/RoleBuilderPage'))
const Staff = lazy(() => import('@/features/settings/StaffPage'))
const StaffInvite = lazy(() => import('@/features/settings/StaffInvitePage'))
const TransactionControls = lazy(() => import('@/features/settings/TransactionControlsPage'))
const AuditLog = lazy(() => import('@/features/settings/AuditLogPage'))
const PinSetup = lazy(() => import('@/features/settings/PinSetupPage'))
const Shortcuts = lazy(() => import('@/features/settings/ShortcutsPage'))
const GstSettings = lazy(() => import('@/features/tax/GstSettingsPage'))
const TaxCategories = lazy(() => import('@/features/tax/TaxCategoriesPage'))
const CreateTaxCategory = lazy(() => import('@/features/tax/CreateTaxCategoryPage'))
const EditTaxCategory = lazy(() => import('@/features/tax/EditTaxCategoryPage'))
const CurrencySettings = lazy(() => import('@/features/settings/currency/CurrencySettingsPage'))
const RecurringList = lazy(() => import('@/features/recurring/RecurringListPage'))
const GstReconciliationList = lazy(() => import('@/features/gst-reconciliation/ReconciliationListPage'))
const GstReconciliationDetail = lazy(() => import('@/features/gst-reconciliation/ReconciliationDetailPage'))
const ChartOfAccounts = lazy(() => import('@/features/accounting/ChartOfAccountsPage'))
const JournalEntries = lazy(() => import('@/features/accounting/JournalEntriesPage'))
const TrialBalance = lazy(() => import('@/features/accounting/TrialBalancePage'))
const BankAccounts = lazy(() => import('@/features/bank-accounts/BankAccountsPage'))
const Expenses = lazy(() => import('@/features/expenses/ExpensesPage'))
const OtherIncome = lazy(() => import('@/features/other-income/OtherIncomePage'))
const Cheques = lazy(() => import('@/features/cheques/ChequesPage'))
const Loans = lazy(() => import('@/features/loans/LoansPage'))
const LoanDetail = lazy(() => import('@/features/loans/LoanDetailPage'))
const ProfitLoss = lazy(() => import('@/features/reports/ProfitLossPage'))
const BalanceSheet = lazy(() => import('@/features/reports/BalanceSheetPage'))
const CashFlow = lazy(() => import('@/features/reports/CashFlowPage'))
const AgingReport = lazy(() => import('@/features/reports/AgingReportPage'))
const ProfitabilityReport = lazy(() => import('@/features/reports/ProfitabilityReportPage'))
const DiscountReport = lazy(() => import('@/features/reports/DiscountReportPage'))
const TallyExport = lazy(() => import('@/features/reports/TallyExportPage'))
const FYClosure = lazy(() => import('@/features/accounting/FYClosurePage'))
const More = lazy(() => import('@/features/more/MorePage'))
const BillScan = lazy(() => import('@/features/bill-scan/BillScanPage'))
const BulkImport = lazy(() => import('@/features/bulk-import/BulkImportPage'))
const PublicLedger = lazy(() => import('@/features/shared-ledger/PublicLedgerPage'))
const ItemsLibrary = lazy(() => import('@/features/items-library/ItemsLibraryPage'))
const DataImport = lazy(() => import('@/features/data-import/DataImportPage'))
const SmartGreetings = lazy(() => import('@/features/smart-greetings/SmartGreetingsPage'))
const Units = lazy(() => import('@/features/units/UnitsPage'))
const Landing = lazy(() => import('@/features/landing/LandingPage'))
const NotFound = lazy(() => import('@/components/feedback/NotFoundPage'))

/** Route-level ErrorBoundary + Suspense wrapper for individual pages */
function PageRoute({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Spinner fullScreen />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

/** Redirect to login if not authenticated */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner fullScreen />
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />
  return <>{children}</>
}

/** Redirect to dashboard if already authenticated */
function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner fullScreen />
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />
  return <>{children}</>
}

export function App() {
  useRoutePreload()

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <PageTransition>
      <Routes>
        <Route path={ROUTES.HOME} element={<PageRoute><GuestRoute><Landing /></GuestRoute></PageRoute>} />
        <Route path={ROUTES.LOGIN} element={<PageRoute><GuestRoute><Login /></GuestRoute></PageRoute>} />
        <Route path={ROUTES.ONBOARDING} element={<PageRoute><ProtectedRoute><Onboarding /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.DASHBOARD} element={<PageRoute><ProtectedRoute><Dashboard /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTIES} element={<PageRoute><ProtectedRoute><Parties /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTY_NEW} element={<PageRoute><ProtectedRoute><CreateParty /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTY_DETAIL} element={<PageRoute><ProtectedRoute><PartyDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PARTY_EDIT} element={<PageRoute><ProtectedRoute><EditParty /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCTS} element={<PageRoute><ProtectedRoute><Products /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCT_NEW} element={<PageRoute><ProtectedRoute><CreateProduct /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCT_DETAIL} element={<PageRoute><ProtectedRoute><ProductDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PRODUCT_EDIT} element={<PageRoute><ProtectedRoute><EditProduct /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICES} element={<PageRoute><ProtectedRoute><Invoices /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICE_CREATE} element={<PageRoute><ProtectedRoute><CreateInvoice /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICE_DETAIL} element={<PageRoute><ProtectedRoute><InvoiceDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.INVOICE_EDIT} element={<PageRoute><ProtectedRoute><EditInvoice /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.TEMPLATES} element={<PageRoute><ProtectedRoute><TemplateGallery /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.TEMPLATE_EDIT} element={<PageRoute><ProtectedRoute><TemplateEditor /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYMENTS} element={<PageRoute><ProtectedRoute><Payments /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYMENT_NEW} element={<PageRoute><ProtectedRoute><RecordPayment /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYMENT_DETAIL} element={<PageRoute><ProtectedRoute><PaymentDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PAYMENT_EDIT} element={<PageRoute><ProtectedRoute><EditPayment /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.OUTSTANDING} element={<PageRoute><ProtectedRoute><Outstanding /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORTS} element={<PageRoute><ProtectedRoute><ReportsHub /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_SALES} element={<PageRoute><ProtectedRoute><SaleReport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PURCHASES} element={<PageRoute><ProtectedRoute><PurchaseReport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PARTY_STATEMENT} element={<PageRoute><ProtectedRoute><PartyStatement /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_STOCK_SUMMARY} element={<PageRoute><ProtectedRoute><StockSummary /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_DAY_BOOK} element={<PageRoute><ProtectedRoute><DayBook /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PAYMENT_HISTORY} element={<PageRoute><ProtectedRoute><PaymentHistory /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_TAX_SUMMARY} element={<PageRoute><ProtectedRoute><TaxSummary /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_GST_RETURNS} element={<PageRoute><ProtectedRoute><GstReturns /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_TDS_TCS} element={<PageRoute><ProtectedRoute><TdsTcsReport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS} element={<PageRoute><ProtectedRoute><Settings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_ROLES} element={<PageRoute><ProtectedRoute><Roles /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_ROLE_NEW} element={<PageRoute><ProtectedRoute><RoleBuilder /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_ROLE_EDIT} element={<PageRoute><ProtectedRoute><RoleBuilder /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_STAFF} element={<PageRoute><ProtectedRoute><Staff /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_STAFF_INVITE} element={<PageRoute><ProtectedRoute><StaffInvite /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SECURITY} element={<PageRoute><ProtectedRoute><PinSetup /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TRANSACTION_CONTROLS} element={<PageRoute><ProtectedRoute><TransactionControls /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_AUDIT_LOG} element={<PageRoute><ProtectedRoute><AuditLog /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SHORTCUTS} element={<PageRoute><ProtectedRoute><Shortcuts /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_PIN_SETUP} element={<PageRoute><ProtectedRoute><PinSetup /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_GST} element={<PageRoute><ProtectedRoute><GstSettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TAX_RATES} element={<PageRoute><ProtectedRoute><TaxCategories /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TAX_RATE_NEW} element={<PageRoute><ProtectedRoute><CreateTaxCategory /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TAX_RATE_EDIT} element={<PageRoute><ProtectedRoute><EditTaxCategory /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_CURRENCY} element={<PageRoute><ProtectedRoute><CurrencySettings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_UNITS} element={<PageRoute><ProtectedRoute><Units /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.RECURRING} element={<PageRoute><ProtectedRoute><RecurringList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_RECONCILIATION} element={<PageRoute><ProtectedRoute><GstReconciliationList /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GST_RECONCILIATION_DETAIL} element={<PageRoute><ProtectedRoute><GstReconciliationDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CHART_OF_ACCOUNTS} element={<PageRoute><ProtectedRoute><ChartOfAccounts /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.JOURNAL_ENTRIES} element={<PageRoute><ProtectedRoute><JournalEntries /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.TRIAL_BALANCE} element={<PageRoute><ProtectedRoute><TrialBalance /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BANK_ACCOUNTS} element={<PageRoute><ProtectedRoute><BankAccounts /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.EXPENSES} element={<PageRoute><ProtectedRoute><Expenses /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.OTHER_INCOME} element={<PageRoute><ProtectedRoute><OtherIncome /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CHEQUES} element={<PageRoute><ProtectedRoute><Cheques /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.LOANS} element={<PageRoute><ProtectedRoute><Loans /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.LOAN_DETAIL} element={<PageRoute><ProtectedRoute><LoanDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PROFIT_LOSS} element={<PageRoute><ProtectedRoute><ProfitLoss /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_BALANCE_SHEET} element={<PageRoute><ProtectedRoute><BalanceSheet /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_CASH_FLOW} element={<PageRoute><ProtectedRoute><CashFlow /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_AGING} element={<PageRoute><ProtectedRoute><AgingReport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_PROFITABILITY} element={<PageRoute><ProtectedRoute><ProfitabilityReport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.REPORT_DISCOUNTS} element={<PageRoute><ProtectedRoute><DiscountReport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.TALLY_EXPORT} element={<PageRoute><ProtectedRoute><TallyExport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.FY_CLOSURE} element={<PageRoute><ProtectedRoute><FYClosure /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BILL_SCAN} element={<PageRoute><ProtectedRoute><BillScan /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BULK_IMPORT_PARTIES} element={<PageRoute><ProtectedRoute><BulkImport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.MORE} element={<PageRoute><ProtectedRoute><More /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ITEMS_LIBRARY} element={<PageRoute><ProtectedRoute><ItemsLibrary /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.DATA_IMPORT} element={<PageRoute><ProtectedRoute><DataImport /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SMART_GREETINGS} element={<PageRoute><ProtectedRoute><SmartGreetings /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.PUBLIC_LEDGER} element={<PageRoute><PublicLedger /></PageRoute>} />
        <Route path="*" element={<PageRoute><NotFound /></PageRoute>} />
      </Routes>
      </PageTransition>
      <CalculatorOverlay />
      <ToastContainer />
      <SWUpdatePrompt />
      <FeedbackWidget />
    </ErrorBoundary>
  )
}
