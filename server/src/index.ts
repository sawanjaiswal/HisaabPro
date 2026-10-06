import 'dotenv/config'
import { initSentry } from './lib/sentry.js'
import { runBootGuards } from './lib/boot-guards.js'
import { createApp } from './app.js'
import logger from './lib/logger.js'

// Initialize error tracking before app starts
initSentry()

// Every boot-time refusal in one call (SR-3): MB-5 NIC_ENV, the scoped-prisma
// mode/cutover guard (M3), and the C4 retention/watch-window precondition.
// Called here because `validateScopedPrismaBoot` shipped with zero call sites —
// a boot guard nobody invokes is a control only in review.
runBootGuards()

// ─── Process-level error handlers (catch unhandled async errors) ─────────────

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception — shutting down', {
    message: error.message,
    stack: error.stack,
  })
  process.exit(1)
})

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

const app = createApp()
const PORT = process.env.PORT || 5001

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})

// Fail fast on a port collision instead of lingering half-bound. A stale/orphaned
// API process holding this port is the usual cause of "app worked, then died":
// the frontend proxy starts returning 502 BACKEND_DOWN. Exit clearly so the
// tsx-watch respawn (or the operator) surfaces it.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      `FATAL: port ${PORT} is already in use — another server (likely a stale HisaabPro API process) is holding it. Free it with: lsof -ti tcp:${PORT} | xargs kill`,
    )
  } else {
    logger.error(`FATAL: server failed to start: ${err.message}`)
  }
  process.exit(1)
})

// 11:59 PM IST Executive Daily Digest
import { runDailyAdminDigest } from './services/admin-daily-digest/index.js'

let lastDailyDigestDateRan = ''
setInterval(() => {
  try {
    const now = new Date()
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = istFormatter.formatToParts(now)
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || ''
    const todayIst = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const istHour = parseInt(getPart('hour'), 10)
    const istMinute = parseInt(getPart('minute'), 10)

    if (istHour === 23 && istMinute >= 59 && lastDailyDigestDateRan !== todayIst) {
      lastDailyDigestDateRan = todayIst
      void runDailyAdminDigest(todayIst).catch((err) => {
        logger.error('Daily admin digest cron tick failed', { err })
      })
    }
  } catch (err) {
    logger.error('Error checking daily digest schedule', { err })
  }
}, 60 * 1000)

