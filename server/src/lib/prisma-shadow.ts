/**
 * Shadow harness composition root (File #21, ARCHITECTURE §5, §5.1, §5.2).
 *
 * Orchestration only. The comparison lives in `diff`, the decision in `classify`,
 * the PII wall in `redact`, the resource budget in `throttle`, persistence in
 * `sink`/`stats`. This file decides the ORDER those run in and owns the harness's
 * single fire-and-forget boundary.
 *
 * Two properties are load-bearing and neither is obvious from reading downward:
 *
 *   1. `observe()` never rejects. Its whole body is wrapped, and its terminal
 *      handlers are themselves wrapped (N-2) — `.catch(fn)` contains a rejection
 *      only if `fn` cannot throw, and `logger.error`/`captureException` are
 *      third-party calls that carry no such guarantee. A throwing handler
 *      re-raises exactly the unhandled rejection this structure exists to remove.
 *
 *   2. A non-divergent comparison writes NO divergence row — one stat bump only
 *      (§5.1). That is what keeps the divergence table an anomaly table, and it is
 *      why exit criterion 2 counts `observed-framed` stats rather than divergence
 *      rows: an anomaly table reads near-zero during precisely the outcome it is
 *      meant to certify (RS-1).
 */
import { SHADOW_TIMEOUT_MS } from './prisma-shadow.constants.js'
import { classify } from './prisma-shadow.classify.js'
import { diffIds } from './prisma-shadow.diff.js'
import { buildErrorRecord, buildNoContextRecord, buildRecord } from './prisma-shadow.redact.js'
import { createShadowSink, type ShadowSink } from './prisma-shadow.sink.js'
import { createShadowStats, type ShadowStats } from './prisma-shadow.stats.js'
import { createShadowThrottle, type ShadowThrottle } from './prisma-shadow.throttle.js'
import { getRequestMeta } from './request-meta.js'
import logger from './logger.js'
import { Sentry } from './sentry.js'
import type {
  ScopedShadowDivergenceRecord,
  ShadowDb,
  ShadowObserveInput,
  ShadowPort,
  ShadowPortSnapshot,
  ShadowStatKind,
} from './prisma-shadow.types.js'

export interface ShadowPortConfig {
  db: ShadowDb
  sampleRate: number
  timeoutMs?: number
  now?: () => number
  random?: () => number
  /** Overridable for the harness tests; production always gets the real pair. */
  sink?: ShadowSink
  stats?: ShadowStats
  throttle?: ShadowThrottle
}

/** The probe lost its race. Distinct from a probe that threw — different diagnosis. */
export class ShadowProbeTimeout extends Error {
  constructor(ms: number) {
    super(`Shadow probe exceeded ${ms}ms`)
    this.name = 'ShadowProbeTimeout'
  }
}

/** Sink gauge saturated. Backpressure, not a broken pipe — see N-1. */
export class ShadowSinkSaturated extends Error {
  constructor() {
    super('Shadow sink inflight gauge saturated')
    this.name = 'ShadowSinkSaturated'
  }
}

function raceTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout
  const bomb = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ShadowProbeTimeout(ms)), ms)
    // Never hold the event loop open for a probe — a pending timer here would
    // delay process exit on every shutdown for no observational gain.
    timer.unref?.()
  })
  return Promise.race([work, bomb]).finally(() => clearTimeout(timer))
}

export function createShadowPort(config: ShadowPortConfig): ShadowPort {
  const { db } = config
  const now = config.now ?? (() => Date.now())
  const timeoutMs = config.timeoutMs ?? SHADOW_TIMEOUT_MS
  const sink = config.sink ?? createShadowSink({ db, now })
  const stats = config.stats ?? createShadowStats({ db, now })
  const throttle =
    config.throttle ??
    createShadowThrottle({ sampleRate: config.sampleRate, now, random: config.random })

  // In-process, deliberately NOT ScopedShadowStat rows (B-3, §15.1): reporting a
  // failed DB write by writing to the DB is the same defect one level down. The
  // durable twin is the watchdog's `sampled = 0` page, which covers the restart
  // that clears these.
  let sinkWriteFailed = 0
  let sinkShed = 0
  let harnessErrors = 0

  function countHarnessError(): void {
    try {
      harnessErrors += 1
    } catch {
      /* N-2 — total. Nothing above this can recover. */
    }
  }

  function onSinkShed(): void {
    try {
      sinkShed += 1
      throttle.recordError() // sustained saturation is a degraded sink; latch it
      logger.warn('[shadow] sink shed — inflight gauge saturated')
    } catch {
      /* N-2 — total */
    }
  }

  function onSinkFailure(err: unknown): void {
    try {
      sinkWriteFailed += 1
      throttle.recordError()
      const errorName = err instanceof Error ? err.name : 'UnknownThrow'
      // Name only. `err.message` from Prisma embeds the failing field VALUES.
      logger.error(`[shadow] sink write failed (${errorName})`)
      Sentry.captureException(err, { fingerprint: ['shadow', 'sink-write-failed'] })
    } catch {
      /* N-2 — last handler in the harness */
    }
  }

  /** The harness's ONLY fire-and-forget boundary. No bare `void promise` exists. */
  function emit(record: ScopedShadowDivergenceRecord, statKinds: ShadowStatKind[]): void {
    if (!throttle.enterSink()) {
      onSinkShed()
      return
    }
    void sink
      .write(record)
      .then(() => stats.bump(statKinds))
      .catch(onSinkFailure)
      .finally(() => throttle.exitSink())
  }

  function emitStatsOnly(statKinds: ShadowStatKind[], routeHint: string): void {
    if (!throttle.enterSink()) {
      onSinkShed()
      return
    }
    void stats
      .bump(statKinds, routeHint)
      .catch(onSinkFailure)
      .finally(() => throttle.exitSink())
  }

  async function observe(input: ShadowObserveInput): Promise<void> {
    try {
      const t0 = now()

      let unscopedRows: unknown
      try {
        unscopedRows = await input.real
      } catch {
        // The caller's own query failed. There is nothing to compare against, and
        // the rejection is already the caller's to handle — swallowing it HERE
        // would be wrong, but we never re-throw it either.
        return
      }

      const meta = getRequestMeta()
      const routeHint = meta?.getRouteHint() ?? ''
      const ctx = {
        model: input.model,
        operation: input.operation,
        meta,
        subjectBusinessId: input.businessId ?? null,
        observationIntervalMs: 0,
        argFlags: input.argFlags,
      }

      // ── NO-CONTEXT BRANCH (AA-5) — before any probe, before any pool slot ──
      // Without this branch a context-free read reached the probe with
      // `businessId === undefined`, injectScope built `{ businessId: undefined }`,
      // Prisma DROPPED the key, the probe ran unscoped, the diff came back empty,
      // and the record certified the read as non-divergent. With zero runUnscoped
      // adopters that is ~100% of cron and pre-business traffic marking itself
      // clean — the epic's own catastrophic outcome (b).
      if (!input.businessId) {
        emit(buildNoContextRecord({ ...ctx, observationIntervalMs: now() - t0 }), [
          'sampled',
          'no-context',
        ])
        return
      }

      if (!throttle.enterProbe()) return
      try {
        const scopedRows = await raceTimeout(input.runScoped(input.businessId), timeoutMs)
        const interval = now() - t0
        throttle.recordLatency(interval)

        const diff = diffIds(unscopedRows, scopedRows)
        const kind = classify(diff, input.argFlags, interval)

        if (kind === 'clean') {
          emitStatsOnly(['sampled', 'observed-framed'], routeHint)
        } else {
          emit(buildRecord(kind, diff, { ...ctx, observationIntervalMs: interval }), [
            'sampled',
            kind,
          ])
        }
      } catch (err) {
        throttle.recordError()
        emit(buildErrorRecord(err, { ...ctx, observationIntervalMs: now() - t0 }), [
          'sampled',
          'shadow-error',
        ])
      } finally {
        throttle.exitProbe()
      }
    } catch {
      // Anything the branches above missed. `observe` returning a rejected promise
      // would kill the process at the call site's terminal `.catch` boundary.
      countHarnessError()
    }
  }

  function snapshot(): ShadowPortSnapshot {
    const s = sink.snapshot()
    return {
      sinkWriteFailed,
      sinkShed,
      harnessErrors,
      keysThisHour: s.keysThisHour,
      keyCapShed: s.keyCapShed,
    }
  }

  return {
    shouldSample: () => throttle.shouldSample(),
    observe,
    countHarnessError,
    snapshot,
  }
}
