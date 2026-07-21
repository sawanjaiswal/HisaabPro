/**
 * Phase 0 spike — mechanism proof (File #1, ARCHITECTURE §13).
 *
 * This is a GATE, not a task. Two assumptions carry the whole epic:
 *
 *   1. `Promise.resolve(q(args))` reuses the caller's continuation rather than
 *      re-executing it. If it re-executes, every shadowed read costs the caller
 *      an extra query and §4.1's performance budget is wrong.
 *   2. A re-dispatched probe through the inner client costs exactly one more
 *      statement — no guard-chain amplification. Read plans are all
 *      `noGuards(...)` (`prisma-scoped.inject.ts:133-138`), so `executePlan`'s
 *      `runGuards` loop is a genuine no-op and "exactly one more" is the right
 *      expected value, not a hopeful one.
 *
 * If either assertion fails, STOP and redesign §4.1/§4.3 before writing
 * anything else.
 *
 * Counting rule (SS-4): only `$on('query')` events whose SQL matches `^SELECT`.
 * `base.$on('query')` also emits BEGIN/COMMIT for batched operations and does
 * not distinguish them from the statement under test. "Exactly 1" without the
 * filter is flaky, and a flaky gate gets loosened to "<= 2" on its second red
 * run — at which point it no longer distinguishes one query from two, which is
 * the only thing it exists to measure.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

/** Statement counter over the raw client's query events, `^SELECT` only. */
class SelectCounter {
  private n = 0
  private armed = false

  arm(): void {
    this.n = 0
    this.armed = true
  }

  record(sql: string): void {
    if (this.armed && /^SELECT/i.test(sql.trim())) this.n += 1
  }

  /** Stop counting and return the total. */
  read(): number {
    this.armed = false
    return this.n
  }
}

const counter = new SelectCounter()

// The base client must emit query events, which requires event-style logging.
const base = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })

beforeAll(async () => {
  base.$on('query', (e: { query: string }) => counter.record(e.query))
  await base.$connect()
})

afterAll(async () => {
  await base.$disconnect()
})

describe('Phase 0 — mechanism proof', () => {
  it('a bare read is exactly one SELECT (counter calibration)', async () => {
    counter.arm()
    await base.party.findMany({ take: 1 })
    expect(counter.read()).toBe(1)
  })

  it('Promise.resolve(q(args)) reuses the continuation — 1 SELECT, not 2', async () => {
    let observed = -1

    const wrapped = base.$extends({
      query: {
        party: {
          async findMany({ args, query }) {
            counter.arm()
            // The exact shape §4.1 relies on: wrap the continuation in a
            // settled promise, then await it once. If Prisma's lazy promise
            // re-executes on the second await, this reads 2.
            const p = Promise.resolve(query(args))
            const first = await p
            const second = await p
            observed = counter.read()
            expect(second).toBe(first)
            return first
          },
        },
      },
    })

    await wrapped.party.findMany({ take: 1 })
    expect(observed).toBe(1)
  })

  it('a re-dispatched probe costs exactly one more SELECT', async () => {
    let callerSide = -1
    let probeSide = -1

    const wrapped = base.$extends({
      query: {
        party: {
          async findMany({ args, query }) {
            counter.arm()
            const real = await Promise.resolve(query(args))
            callerSide = counter.read()

            // The probe: re-dispatch through the inner client rather than
            // re-invoking the caller's continuation a second time (D-7 — double
            // invocation inside one $allOperations is an unproven mechanism).
            counter.arm()
            await base.party.findMany({ ...args, take: 1 })
            probeSide = counter.read()

            return real
          },
        },
      },
    })

    await wrapped.party.findMany({ take: 1 })
    expect(callerSide).toBe(1)
    expect(probeSide).toBe(1)
  })
})
