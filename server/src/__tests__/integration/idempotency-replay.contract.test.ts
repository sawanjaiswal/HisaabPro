/**
 * Idempotent replay — server-side single application (REAL DB, REAL middleware).
 *
 * The client replay test (src/lib/__tests__/offline-replay.test.ts) proves the
 * queue sends each offline mutation once, carrying a STABLE X-Idempotency-Key,
 * and explicitly delegates the other half — "the server applies a replayed key
 * exactly once" — to a live-server integration test. This is that test.
 *
 * The shared setup.ts passthrough-mocks idempotencyCheck (most contract tests
 * don't want dedup interfering); this file un-mocks it to exercise the real
 * middleware against IdempotencyLog. Every test uses a fresh key, and
 * IdempotencyLog is not in the beforeEach TRUNCATE set, so keys can't collide.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// Use the REAL idempotency middleware, not the shared setup's passthrough.
vi.unmock('../../middleware/idempotency.js')

import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

const key = () => crypto.randomUUID()

function paymentBody(partyId: string, amount = 50000) {
  return {
    type: 'PAYMENT_IN',
    partyId,
    amount,
    date: new Date().toISOString().split('T')[0],
    mode: 'CASH' as const,
  }
}

// IdempotencyLog persists across the beforeEach TRUNCATE (not in its table set);
// clear it here so a test never sees a prior test's stored key.
beforeEach(async () => {
  await prisma.idempotencyLog.deleteMany({})
})

describe('idempotent replay — same key applies exactly once', () => {
  it('replaying a POST /api/payments with the same key creates one payment', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const k = key()

    const first = await authRequest(app, token)
      .post('/api/payments')
      .set('X-Idempotency-Key', k)
      .send(paymentBody(party.id))
    expect(first.status).toBe(201)
    const firstId = first.body.data.id

    const partyAfterFirst = await prisma.party.findUnique({ where: { id: party.id } })

    // Replay: identical body, identical key. Server returns the cached response.
    const replay = await authRequest(app, token)
      .post('/api/payments')
      .set('X-Idempotency-Key', k)
      .send(paymentBody(party.id))
    expect(replay.status).toBe(200) // IDEMPOTENCY_HIT returns the stored 2xx body
    expect(replay.body.data.id).toBe(firstId) // same entity, not a new one

    // Single application: exactly one payment row, outstanding debited once.
    const count = await prisma.payment.count({ where: { businessId: business.id } })
    expect(count).toBe(1)
    const partyAfterReplay = await prisma.party.findUnique({ where: { id: party.id } })
    expect(partyAfterReplay!.outstandingBalance).toBe(partyAfterFirst!.outstandingBalance)
  })
})

describe('idempotent replay — the key is what dedupes', () => {
  it('two different keys create two payments (debited twice)', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    await authRequest(app, token).post('/api/payments').set('X-Idempotency-Key', key()).send(paymentBody(party.id, 10000))
    await authRequest(app, token).post('/api/payments').set('X-Idempotency-Key', key()).send(paymentBody(party.id, 10000))

    const count = await prisma.payment.count({ where: { businessId: business.id } })
    expect(count).toBe(2)
  })

  it('no key means no dedupe — two identical POSTs create two payments', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    await authRequest(app, token).post('/api/payments').send(paymentBody(party.id, 10000))
    await authRequest(app, token).post('/api/payments').send(paymentBody(party.id, 10000))

    const count = await prisma.payment.count({ where: { businessId: business.id } })
    expect(count).toBe(2)
  })
})

describe('idempotent replay — the cache is per-user (no cross-tenant leak)', () => {
  it('the same key from a different user is not a hit — no cached response leaks', async () => {
    const a = await seedFullSetup()
    const b = await seedFullSetup()
    const tokenA = generateToken(a.user.id, a.user.phone, a.business.id)
    const tokenB = generateToken(b.user.id, b.user.phone, b.business.id)
    const shared = key()

    const resA = await authRequest(app, tokenA).post('/api/payments').set('X-Idempotency-Key', shared).send(paymentBody(a.party.id))
    expect(resA.status).toBe(201)

    // User B reuses A's key: the middleware sees a userId mismatch and falls
    // through to a normal create in B's own business — it must NOT return A's
    // cached payment.
    const resB = await authRequest(app, tokenB).post('/api/payments').set('X-Idempotency-Key', shared).send(paymentBody(b.party.id))
    expect(resB.status).toBe(201)
    expect(resB.body.data.id).not.toBe(resA.body.data.id)

    // Each business has exactly its own one payment.
    expect(await prisma.payment.count({ where: { businessId: a.business.id } })).toBe(1)
    expect(await prisma.payment.count({ where: { businessId: b.business.id } })).toBe(1)
  })
})
