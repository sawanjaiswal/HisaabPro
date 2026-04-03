import 'dotenv/config'
import { createApp } from './app.js'
import logger from './lib/logger.js'

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
const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
