// #150 collaboration constants.

/** Client heartbeat cadence — server TTL is 45s, so 20s gives 2 misses of slack. */
export const HEARTBEAT_INTERVAL_MS = 20_000

/** Max peer avatars rendered before collapsing into a "+N" chip. */
export const MAX_VISIBLE_AVATARS = 3

/** Error code the optimistic-lock backend uses for a stale write. */
export const CONFLICT_CODE = 'CONFLICT'
