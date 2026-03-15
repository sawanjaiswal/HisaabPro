import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { Spinner } from '@/components/feedback/Spinner'
import { ToastContainer } from '@/components/feedback/ToastContainer'
import { OfflineBanner } from '@/components/feedback/OfflineBanner'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { useAuth } from '@/context/AuthContext'
import { CalculatorOverlay } from '@/features/settings/CalculatorOverlay'

/** Lazy-loaded pages — split per route for small bundles */
const Login = lazy(() => import('@/features/auth/LoginPage'))
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
const TemplateGallery = lazy(() => import('@/features/templates/TemplateGalleryPage'))
const TemplateEditor = lazy(() => import('@/features/templates/TemplateEditorPage'))
const Payments = lazy(() => import('@/features/payments/PaymentsPage'))
const RecordPayment = lazy(() => import('@/features/payments/RecordPaymentPage'))
const PaymentDetail = lazy(() => import('@/features/payments/PaymentDetailPage'))
const Outstanding = lazy(() => import('@/features/payments/OutstandingPage'))
const ReportsHub = lazy(() => import('@/features/reports/ReportsHubPage'))
const SaleReport = lazy(() => import('@/features/reports/InvoiceReportPage'))
const PurchaseReport = lazy(() => import('@/features/reports/InvoiceReportPage'))
const PartyStatement = lazy(() => import('@/features/reports/PartyStatementPage'))
const StockSummary = lazy(() => import('@/features/reports/StockSummaryPage'))
const DayBook = lazy(() => import('@/features/reports/DayBookPage'))
const PaymentHistory = lazy(() => import('@/features/reports/PaymentHistoryPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))
const Roles = lazy(() => import('@/features/settings/RolesPage'))
const RoleBuilder = lazy(() => import('@/features/settings/RoleBuilderPage'))
const Staff = lazy(() => import('@/features/settings/StaffPage'))
const StaffInvite = lazy(() => import('@/features/settings/StaffInvitePage'))
const TransactionControls = lazy(() => import('@/features/settings/TransactionControlsPage'))
const AuditLog = lazy(() => import('@/features/settings/AuditLogPage'))
const PinSetup = lazy(() => import('@/features/settings/PinSetupPage'))
const Shortcuts = lazy(() => import('@/features/settings/ShortcutsPage'))

/** Redirect to login if not authenticated */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner fullScreen />
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />
  return <>{children}</>
}

/** Redirect to dashboard if already authenticated */
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner fullScreen />
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />
  return <>{children}</>
}

export function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Spinner fullScreen />}>
        <OfflineBanner />
        <Routes>
          <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          <Route path={ROUTES.LOGIN} element={<GuestRoute><Login /></GuestRoute>} />
          <Route path={ROUTES.DASHBOARD} element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path={ROUTES.PARTIES} element={<ProtectedRoute><Parties /></ProtectedRoute>} />
          <Route path={ROUTES.PARTY_NEW} element={<ProtectedRoute><CreateParty /></ProtectedRoute>} />
          <Route path={ROUTES.PARTY_DETAIL} element={<ProtectedRoute><PartyDetail /></ProtectedRoute>} />
          <Route path={ROUTES.PRODUCTS} element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path={ROUTES.PRODUCT_NEW} element={<ProtectedRoute><CreateProduct /></ProtectedRoute>} />
          <Route path={ROUTES.PRODUCT_DETAIL} element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
          <Route path={ROUTES.INVOICES} element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path={ROUTES.INVOICE_CREATE} element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
          <Route path={ROUTES.INVOICE_DETAIL} element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
          <Route path={ROUTES.TEMPLATES} element={<ProtectedRoute><TemplateGallery /></ProtectedRoute>} />
          <Route path={ROUTES.TEMPLATE_EDIT} element={<ProtectedRoute><TemplateEditor /></ProtectedRoute>} />
          <Route path={ROUTES.PAYMENTS} element={<ProtectedRoute><Payments /></ProtectedRoute>} />
          <Route path={ROUTES.PAYMENT_NEW} element={<ProtectedRoute><RecordPayment /></ProtectedRoute>} />
          <Route path={ROUTES.PAYMENT_DETAIL} element={<ProtectedRoute><PaymentDetail /></ProtectedRoute>} />
          <Route path={ROUTES.OUTSTANDING} element={<ProtectedRoute><Outstanding /></ProtectedRoute>} />
          <Route path={ROUTES.REPORTS} element={<ProtectedRoute><ReportsHub /></ProtectedRoute>} />
          <Route path={ROUTES.REPORT_SALES} element={<ProtectedRoute><SaleReport /></ProtectedRoute>} />
          <Route path={ROUTES.REPORT_PURCHASES} element={<ProtectedRoute><PurchaseReport /></ProtectedRoute>} />
          <Route path={ROUTES.REPORT_PARTY_STATEMENT} element={<ProtectedRoute><PartyStatement /></ProtectedRoute>} />
          <Route path={ROUTES.REPORT_STOCK_SUMMARY} element={<ProtectedRoute><StockSummary /></ProtectedRoute>} />
          <Route path={ROUTES.REPORT_DAY_BOOK} element={<ProtectedRoute><DayBook /></ProtectedRoute>} />
          <Route path={ROUTES.REPORT_PAYMENT_HISTORY} element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS} element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_ROLES} element={<ProtectedRoute><Roles /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_ROLE_NEW} element={<ProtectedRoute><RoleBuilder /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_ROLE_EDIT} element={<ProtectedRoute><RoleBuilder /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_STAFF} element={<ProtectedRoute><Staff /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_STAFF_INVITE} element={<ProtectedRoute><StaffInvite /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_SECURITY} element={<ProtectedRoute><PinSetup /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_TRANSACTION_CONTROLS} element={<ProtectedRoute><TransactionControls /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_AUDIT_LOG} element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_SHORTCUTS} element={<ProtectedRoute><Shortcuts /></ProtectedRoute>} />
          <Route path={ROUTES.SETTINGS_PIN_SETUP} element={<ProtectedRoute><PinSetup /></ProtectedRoute>} />
        </Routes>
      </Suspense>
      <CalculatorOverlay />
      <ToastContainer />
      <FeedbackWidget />
    </ErrorBoundary>
  )
}
