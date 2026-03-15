import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { sendSuccess } from './lib/response.js'
import { errorHandler } from './middleware/errorHandler.js'
import { performanceMonitoring } from './middleware/performance.js'
import { apiRateLimiter } from './middleware/rate-limit.js'
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
import logger from './lib/logger.js'

const app = express()
const PORT = process.env.PORT || 4000

// Security & parsing
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }))
app.use(compression())
app.use(express.json({ limit: '10mb' }))

// Infrastructure middleware
app.use(performanceMonitoring)
app.use(apiRateLimiter)

// Health check
app.get('/api/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
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

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

// Global error handler (must be last)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
