/**
 * Shadow probe race + its two failure signals (split out of the composition
 * root, File #21). Kept separate because the timeout mechanism is orthogonal to
 * the observe/emit ORDER that `prisma-shadow.ts` owns — and because the two
 * error classes are the vocabulary the sink and status service read back
 * (`errorName === 'ShadowProbeTimeout'`), not implementation detail of observe.
 */

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

export function raceTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout
  const bomb = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ShadowProbeTimeout(ms)), ms)
    // Never hold the event loop open for a probe — a pending timer here would
    // delay process exit on every shutdown for no observational gain.
    timer.unref?.()
  })
  return Promise.race([work, bomb]).finally(() => clearTimeout(timer))
}
