import { Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { useQueryClient } from '@tanstack/react-query'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { Spinner } from '@/components/feedback/Spinner'
import { ToastContainer } from '@/components/feedback/ToastContainer'
import { OfflineBanner } from '@/components/feedback/OfflineBanner'
import { SWUpdatePrompt } from '@/components/feedback/SWUpdatePrompt'
import { PageTransition } from '@/components/layout/PageTransition'
import { useAuth } from '@/context/AuthContext'
import { useRoutePreload } from '@/hooks/useRoutePreload'
import { useSSE } from '@/hooks/useSSE'
import {
  CalculatorOverlay, FeedbackWidget,
  Login, Register, VerifyOtp, ForgotPassword, Onboarding, Dashboard,
  Parties, CreateParty, PartyDetail, EditParty,
  Products, CreateProduct, ProductDetail, EditProduct,
  Invoices, CreateInvoice, InvoiceDetail, EditInvoice,
  TemplateGallery, TemplateEditor,
  Payments, RecordPayment, PaymentDetail, EditPayment, Outstanding,
  ReportsHub, SaleReport, PurchaseReport, PartyStatement, StockSummary,
  DayBook, PaymentHistory, TaxSummary, GstReturns, TdsTcsReport,
  Settings, Roles, RoleBuilder, Staff, StaffInvite, StaffPermissions,
  TransactionControls, AuditLog, ActiveSessions, PinSetup, Shortcuts,
  GstSettings, TaxCategories, CreateTaxCategory, EditTaxCategory,
  CurrencySettings, RecurringList,
  GstReconciliationList, GstReconciliationDetail,
  ChartOfAccounts, JournalEntries, TrialBalance,
  BankAccounts, Expenses, OtherIncome, Cheques, Loans, LoanDetail,
  ProfitLoss, BalanceSheet, CashFlow, AgingReport, ProfitabilityReport,
  DiscountReport, TallyExport, FYClosure,
  More, BillScan, BulkImport, PublicLedger, ItemsLibrary, DataImport,
  SmartGreetings, Units, JoinBusiness, CreateBusiness, Landing,
  AdminCoupons, AdminCouponDetail,
  Batches, CreateBatch, BatchDetail,
  Godowns, CreateGodown, EditGodown, GodownDetail, GodownTransfer,
  StockVerifications, VerificationDetail,
  Serials, CreateSerial, BulkCreateSerial, SerialLookup, Pos,
  NotFound,
} from '@/app.routes'

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

/** Host-based root route: landing on marketing, login on app host and native, admin on admin host */
function HomeGate() {
  const isNative = Capacitor.isNativePlatform()
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (isNative || host === 'app.hisaabpro.in') {
    return <GuestRoute><Login /></GuestRoute>
  }
  if (host === 'admin.hisaabpro.in') {
    return <ProtectedRoute><AdminCoupons /></ProtectedRoute>
  }
  return <GuestRoute><Landing /></GuestRoute>
}

export function App() {
  useRoutePreload()
  useSSE() // Real-time sync: SSE → TanStack Query cache invalidation

  const queryClient = useQueryClient()

  // Invalidate all queries when app returns to foreground
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [queryClient])

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <PageTransition>
      <Routes>
        <Route path={ROUTES.HOME} element={<ErrorBoundary><Suspense fallback={<div className="min-h-screen bg-black" />}><HomeGate /></Suspense></ErrorBoundary>} />
        <Route path={ROUTES.LOGIN} element={<PageRoute><GuestRoute><Login /></GuestRoute></PageRoute>} />
        <Route path={ROUTES.REGISTER} element={<PageRoute><GuestRoute><Register /></GuestRoute></PageRoute>} />
        <Route path={ROUTES.VERIFY_OTP} element={<PageRoute><VerifyOtp /></PageRoute>} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<PageRoute><GuestRoute><ForgotPassword /></GuestRoute></PageRoute>} />
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
        <Route path={ROUTES.SETTINGS_PERMISSIONS} element={<PageRoute><ProtectedRoute><StaffPermissions /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SECURITY} element={<PageRoute><ProtectedRoute><PinSetup /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_TRANSACTION_CONTROLS} element={<PageRoute><ProtectedRoute><TransactionControls /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_AUDIT_LOG} element={<PageRoute><ProtectedRoute><AuditLog /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SETTINGS_SESSIONS} element={<PageRoute><ProtectedRoute><ActiveSessions /></ProtectedRoute></PageRoute>} />
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
        <Route path={ROUTES.JOIN_BUSINESS} element={<PageRoute><ProtectedRoute><JoinBusiness /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.CREATE_BUSINESS} element={<PageRoute><ProtectedRoute><CreateBusiness /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ADMIN_COUPONS} element={<PageRoute><ProtectedRoute><AdminCoupons /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.ADMIN_COUPON_DETAIL} element={<PageRoute><ProtectedRoute><AdminCouponDetail /></ProtectedRoute></PageRoute>} />

        {/* Phase 4 — Advanced Inventory */}
        <Route path={ROUTES.BATCH_NEW} element={<PageRoute><ProtectedRoute><CreateBatch /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BATCHES} element={<PageRoute><ProtectedRoute><Batches /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.BATCH_DETAIL} element={<PageRoute><ProtectedRoute><BatchDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_NEW} element={<PageRoute><ProtectedRoute><CreateGodown /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_EDIT} element={<PageRoute><ProtectedRoute><EditGodown /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_TRANSFER} element={<PageRoute><ProtectedRoute><GodownTransfer /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWNS} element={<PageRoute><ProtectedRoute><Godowns /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.GODOWN_DETAIL} element={<PageRoute><ProtectedRoute><GodownDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.STOCK_VERIFICATION} element={<PageRoute><ProtectedRoute><StockVerifications /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.STOCK_VERIFICATION_DETAIL} element={<PageRoute><ProtectedRoute><VerificationDetail /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_NEW} element={<PageRoute><ProtectedRoute><CreateSerial /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_BULK} element={<PageRoute><ProtectedRoute><BulkCreateSerial /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_NUMBERS} element={<PageRoute><ProtectedRoute><Serials /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.SERIAL_LOOKUP} element={<PageRoute><ProtectedRoute><SerialLookup /></ProtectedRoute></PageRoute>} />
        <Route path={ROUTES.POS} element={<PageRoute><ProtectedRoute><Pos /></ProtectedRoute></PageRoute>} />

        <Route path={ROUTES.PUBLIC_LEDGER} element={<PageRoute><PublicLedger /></PageRoute>} />
        <Route path="*" element={<PageRoute><NotFound /></PageRoute>} />
      </Routes>
      </PageTransition>
      <Suspense fallback={null}><CalculatorOverlay /></Suspense>
      <ToastContainer />
      <SWUpdatePrompt />
      <Suspense fallback={null}><FeedbackWidget /></Suspense>
    </ErrorBoundary>
  )
}
