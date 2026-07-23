/**
 * Integration test setup — REAL DB, no Prisma mocks.
 * Mocks only non-DB concerns: rate limiters, CSRF, replay protection,
 * notifications, razorpay, token blacklist.
 */

import { vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'

// ─── Mock non-DB middleware (passthrough) ────────────────────────────────────

// Passthrough every rate limiter — but DERIVE the set from the real module's
// exports so a newly-added limiter is auto-mocked and can never silently break
// app construction (the switchBusinessRateLimiter crash: mock omitted a new
// export → undefined middleware → Router.use throws). Each `create*` export is
// a factory (returns the passthrough); every other function export IS the
// passthrough; non-function exports (constants/types) pass through unchanged.
vi.mock('../../middleware/rate-limit.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const pass = (_req: unknown, _res: unknown, next: () => void) => next()
  const mocked: Record<string, unknown> = {}
  for (const [name, val] of Object.entries(actual)) {
    if (typeof val !== 'function') { mocked[name] = val; continue }
    mocked[name] = name.startsWith('create') ? () => pass : pass
  }
  return mocked
})

vi.mock('../../middleware/csrf.js', () => ({
  csrfProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

vi.mock('../../middleware/replay-protection.js', () => ({
  replayProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
  REPLAY_WINDOW_MS: 300_000,
  CLEANUP_INTERVAL_MS: 60_000,
}))

// ─── Mock non-DB services ────────────────────────────────────────────────────

vi.mock('../../services/notification.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, id: 'mock-email' }),
  sendWhatsApp: vi.fn().mockResolvedValue({ success: true }),
  sendPushNotification: vi.fn().mockResolvedValue({ success: true }),
  notify: vi.fn().mockResolvedValue({ email: true, whatsapp: true }),
}))

vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({
    orders: { create: vi.fn() },
    payments: { fetch: vi.fn() },
    subscriptions: { create: vi.fn(), fetch: vi.fn(), cancel: vi.fn() },
  })),
}))

vi.mock('../../lib/token-blacklist.js', () => ({
  blacklistToken: vi.fn(),
  isBlacklisted: vi.fn().mockReturnValue(false),
  isUserBlacklisted: vi.fn().mockReturnValue(false),
  blacklistUser: vi.fn(),
}))

vi.mock('../../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../middleware/idempotency.js', () => ({
  idempotencyCheck: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

vi.mock('../../services/stock-alert.service.js', () => ({
  checkAndCreateAlerts: vi.fn().mockResolvedValue(undefined),
}))

// ─── DB lifecycle ────────────────────────────────────────────────────────────

/**
 * Tables in reverse-dependency order for clean truncation.
 * CASCADE handles FKs, but explicit order prevents orphan issues.
 */
const TABLES_TO_TRUNCATE = [
  'Expense',
  'ExpenseCategory',
  'PaymentReminder',
  'PaymentDiscount',
  'PaymentAllocation',
  'Payment',
  'DocumentShareLog',
  'DocumentAdditionalCharge',
  'DocumentLineItem',
  'Document',
  'PartyPricing',
  'PartyCustomFieldValue',
  'OpeningBalance',
  'PartyAddress',
  'Party',
  'StockMovement',
  'Product',
  'Category',
  'Unit',
  'JournalEntryLine',
  'JournalEntry',
  'LedgerAccount',
  'BusinessUser',
  'StaffInvite',
  'Role',
  'RefreshToken',
  'Business',
  'User',
]

beforeAll(async () => {
  // Verify real DB connection
  const result = await prisma.$queryRaw`SELECT 1 AS ok`
  if (!result) throw new Error('Integration test DB connection failed')
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  // A single TRUNCATE keeps it one statement, but its AccessExclusiveLock can
  // still lose a deadlock (40P01) to a prior test's fire-and-forget write (an
  // un-awaited GL/audit/notification write on another pooled connection that
  // outlives the response and still holds a RowShareLock). Postgres kills the
  // victim — us — so retry: the short background write finishes and the lock
  // clears. connection_limit=1 was rejected: it turns the transient deadlock
  // into cascading connection starvation (the leaked connection never frees).
  const tables = TABLES_TO_TRUNCATE.map(t => `"${t}"`).join(', ')
  const sql = `TRUNCATE TABLE ${tables} CASCADE`
  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$executeRawUnsafe(sql)
      return
    } catch (err) {
      // Prisma wraps raw-query failures (code P2010) and carries the Postgres
      // code (40P01) in the message/meta — match either so a real deadlock is
      // caught regardless of which layer surfaces it.
      const e = err as { code?: string; message?: string; meta?: { code?: string } }
      const isDeadlock =
        e.code === '40P01' || e.meta?.code === '40P01' || (e.message ?? '').includes('40P01')
      if (!isDeadlock || attempt >= 4) throw err
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)))
    }
  }
})
