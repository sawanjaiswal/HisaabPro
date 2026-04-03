/**
 * Integration test setup — REAL DB, no Prisma mocks.
 * Mocks only non-DB concerns: rate limiters, CSRF, replay protection,
 * notifications, razorpay, token blacklist.
 */

import { vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'

// ─── Mock non-DB middleware (passthrough) ────────────────────────────────────

vi.mock('../../middleware/rate-limit.js', () => {
  const pass = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    apiRateLimiter: pass,
    authRateLimiter: pass,
    otpRateLimiter: pass,
    sensitiveRateLimiter: pass,
    sensitiveMutationLimiter: pass,
    couponValidateRateLimiter: pass,
    couponIpRateLimiter: pass,
    createRateLimiter: () => pass,
  }
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
  // Single TRUNCATE statement avoids deadlocks between concurrent test files
  const tables = TABLES_TO_TRUNCATE.map(t => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`)
})
