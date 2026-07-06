/**
 * Express app factory — separated from index.ts for testability.
 * Tests import createApp() directly without starting the server.
 * Feature route mounts live in app.routes.ts.
 */

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
import { ALLOWED_ORIGINS } from './config/security.js'
import { sanitizeInput } from './middleware/sanitize-input.js'
import { fieldFilter } from './middleware/field-filter.js'
import { sseAutoEmit } from './middleware/sse-emit.js'
import { conflictDetection } from './middleware/conflict-detection.js'
import { prisma } from './lib/prisma.js'
import { razorpayWebhookRouter } from './routes/razorpay.js'
import notificationsWebhookRouter from './routes/webhooks/index.js'
import marketingAisensyWebhookRouter from './routes/webhooks/marketing-aisensy.routes.js'
import marketingMsg91WebhookRouter from './routes/webhooks/marketing-msg91.routes.js'
import { initCronJobs } from './lib/cron-scheduler.js'
import { mountFeatureRoutes } from './app.routes.js'
import publicRouter from './routes/public.routes.js'
import logger from './lib/logger.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  // JSON API — TanStack Query owns client-side caching/invalidation.
  // Express's default weak ETag makes the browser send If-None-Match on
  // repeat GETs, which we then answer with an empty 304 body. The frontend
  // client (src/lib/api.ts) has no use for that and treats it as `data:
  // undefined`, which TanStack Query rejects outright. Disable it at the
  // source. See .claude/fix-trace-sales-hub-etag-304.md.
  app.set('etag', false)
  // Belt-and-suspenders for the same reason: even with etag disabled, a
  // browser can heuristically cache a GET without an explicit directive.
  // no-store forecloses that ambiguity outright.
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

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
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  }))

  app.use(cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))
  app.use(compression())

  // Public router — /api/p/* — mounted BEFORE global auth/CSRF/JSON middleware.
  // No cookie auth, no CSRF, no requireAuth for any route under this prefix.
  app.use('/api/p', publicRouter)
  logger.info('[startup] Public router mounted at /api/p')

  app.use('/api/razorpay', razorpayWebhookRouter)

  // Notification provider webhooks — each sub-route mounts express.raw() itself;
  // must be registered BEFORE the global JSON parser so the raw buffer is preserved.
  app.use('/api/webhooks/notifications', notificationsWebhookRouter)

  // Marketing provider webhooks — raw body, no global JSON parser, no CORS
  app.use('/api/webhooks/marketing/aisensy', marketingAisensyWebhookRouter)
  app.use('/api/webhooks/marketing/msg91', marketingMsg91WebhookRouter)

  // OCR route handles its own parser with 8mb limit; skip global 2mb here.
  // Webhook paths under /api/webhooks/notifications/* use their own raw parsers.
  app.use((req, res, next) => {
    if (req.path === '/api/expenses/ocr') return next()
    if (req.path.startsWith('/api/webhooks/notifications/')) return next()
    if (req.path.startsWith('/api/webhooks/marketing/')) return next()
    return express.json({ limit: '2mb' })(req, res, next)
  })
  app.use(cookieParser())

  app.use(performanceMonitoring)
  app.use(apiRateLimiter)
  app.use(csrfProtection)
  app.use(sanitizeInput)
  app.use(fieldFilter)
  app.use(sseAutoEmit)
  app.use(conflictDetection)

  app.get('/api/health', (_req, res) => {
    sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() })
  })

  app.get('/api/health/detailed', async (_req, res) => {
    const mem = process.memoryUsage()
    const uptime = process.uptime()
    let dbLatencyMs = -1
    let dbStatus: 'ok' | 'slow' | 'down' = 'down'
    try {
      const start = Date.now()
      await prisma.$queryRaw`SELECT 1`
      dbLatencyMs = Date.now() - start
      dbStatus = dbLatencyMs > 500 ? 'slow' : 'ok'
    } catch {
      dbStatus = 'down'
    }
    sendSuccess(res, {
      status: dbStatus === 'down' ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      node: process.version,
    })
  })

  mountFeatureRoutes(app)

  if (process.env.NODE_ENV !== 'test') {
    initCronJobs()
  }

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
  })

  app.use(errorHandler)

  return app
}
