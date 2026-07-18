import 'dotenv/config'
import { initSentry } from './lib/sentry.js'
import { validateNicEnv } from './lib/env.js'
import { createApp } from './app.js'
import logger from './lib/logger.js'

// Initialize error tracking before app starts
initSentry()

// MB-5 boot-fail: throws if NIC_ENV=prod and NODE_ENV !== production
validateNicEnv()

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
