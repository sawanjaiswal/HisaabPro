import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { sendSuccess } from './lib/response.js'
import { errorHandler } from './middleware/errorHandler.js'
import { performanceMonitoring } from './middleware/performance.js'
import { apiRateLimiter } from './middleware/rate-limit.js'
import { csrfProtection } from './middleware/csrf.js'
import authRoutes from './routes/auth.js'
import feedbackRoutes from './routes/feedback.js'
import backupRoutes from './routes/backup.js'
import partyRoutes from './routes/party.js'
import partyGroupRoutes from './routes/party-groups.js'
import customFieldRoutes from './routes/custom-fields.js'
import productRoutes from './routes/products.js'
import categoryRoutes from './routes/categories.js'
import unitRoutes from './routes/units.js'
import inventorySettingsRoutes from './routes/inventory-settings.js'
import documentRoutes from './routes/documents.js'
import documentSettingsRoutes from './routes/document-settings.js'
import paymentRoutes from './routes/payments.js'
import dashboardRoutes from './routes/dashboard.js'
import reportRoutes from './routes/reports.js'
import { businessSettingsRouter, userSettingsRouter, permissionsRouter } from './routes/settings.js'
import referralRoutes from './routes/referral.js'
import taxCategoryRoutes from './routes/tax-categories.js'
import hsnRoutes from './routes/hsn.js'
import gstinRoutes from './routes/gstin.js'
import taxReportRoutes from './routes/tax-reports.js'
import gstReturnRoutes from './routes/gst-returns.js'
import tdsTcsRoutes from './routes/tds-tcs.js'
import einvoiceRoutes from './routes/einvoice.js'
import ewaybillRoutes from './routes/ewaybill.js'
import recurringRoutes from './routes/recurring.js'
import currencyRoutes from './routes/currency.js'
import reconciliationRoutes from './routes/reconciliation.js'
import accountingRoutes from './routes/accounting.js'
import bankRoutes from './routes/bank.js'
import expenseRoutes from './routes/expenses.js'
import otherIncomeRoutes from './routes/other-income.js'
import chequeRoutes from './routes/cheques.js'
import financialReportRoutes from './routes/financial-reports.js'
import loanRoutes from './routes/loans.js'
import fyClosureRoutes from './routes/fy-closure.js'
import couponRoutes from './routes/coupons.js'
import adminRoutes from './routes/admin/index.js'
import logger from './lib/logger.js'

const app = express()
const PORT = process.env.PORT || 4000

// Validate required env vars in production
if (process.env.NODE_ENV === 'production') {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN']
  for (const key of required) {
    if (!process.env[key]) {
      logger.error(`FATAL: ${key} must be set in production`)
      process.exit(1)
    }
  }
}

// Trust proxy (Render, Vercel, etc.) — needed for correct req.ip behind reverse proxy
app.set('trust proxy', 1)

// ---------------------------------------------------------------------------
// Security headers — Feature #70
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}))

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
]
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(compression())
app.use(express.json({ limit: '10mb' }))

// Parse cookies (required for httpOnly token + CSRF cookie reading)
app.use(cookieParser())

// ---------------------------------------------------------------------------
// Infrastructure middleware
// ---------------------------------------------------------------------------
app.use(performanceMonitoring)
app.use(apiRateLimiter)

// CSRF protection on state-changing routes (skipped in dev, skipped for Bearer auth)
app.use(csrfProtection)

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() })
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/backup', backupRoutes)
app.use('/api/parties', partyRoutes)
app.use('/api/party-groups', partyGroupRoutes)
app.use('/api/custom-fields', customFieldRoutes)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/units', unitRoutes)
app.use('/api/settings/inventory', inventorySettingsRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/settings/documents', documentSettingsRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/businesses', businessSettingsRouter)
app.use('/api/users', userSettingsRouter)
app.use('/api/permissions', permissionsRouter)
app.use('/api/referral', referralRoutes)
app.use('/api/tax-categories', taxCategoryRoutes)
app.use('/api/hsn', hsnRoutes)
app.use('/api/gstin', gstinRoutes)
app.use('/api/reports', taxReportRoutes)
app.use('/api/gst/returns', gstReturnRoutes)
app.use('/api/gst/reconciliation', reconciliationRoutes)
app.use('/api/reports', tdsTcsRoutes)
app.use('/api/einvoice', einvoiceRoutes)
app.use('/api/ewaybill', ewaybillRoutes)
app.use('/api/recurring', recurringRoutes)
app.use('/api/currency', currencyRoutes)

// Coupon / Discount Code System
app.use('/api/coupons', couponRoutes)

// Phase 3 — Accounting & Finance
app.use('/api/accounting', accountingRoutes)
app.use('/api/bank-accounts', bankRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/other-income', otherIncomeRoutes)
app.use('/api/cheques', chequeRoutes)
app.use('/api/reports/financial', financialReportRoutes)
app.use('/api/loans', loanRoutes)
app.use('/api/fy-closure', fyClosureRoutes)

// ---------------------------------------------------------------------------
// Admin panel routes — separate JWT audience ('admin'), no CSRF
// IMPORTANT: must be accessible without CSRF token (uses Bearer token only)
// ---------------------------------------------------------------------------
app.use('/api/admin', adminRoutes)

// ---------------------------------------------------------------------------
// 404 + global error handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
