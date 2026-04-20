/**
 * Security configuration constants — single source of truth.
 * All timing, threshold, and cookie values live here.
 */

// --- Account lockout ---

/** Number of consecutive failed logins before account is locked */
export const LOCKOUT_MAX_ATTEMPTS = 5

/** How long an account stays locked (ms) — 15 minutes */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000

/** Progressive delay per failed attempt (ms) — capped at MAX_PROGRESSIVE_DELAY_MS */
export const PROGRESSIVE_DELAY_PER_ATTEMPT_MS = 500

/** Max artificial delay added before responding to a failed login (ms) */
export const MAX_PROGRESSIVE_DELAY_MS = 3_000

// --- JWT / Cookie ---

/**
 * Cookie names.
 * __Host- prefix requires Secure=true + Path=/ + no Domain → only works over HTTPS.
 * __Secure- prefix requires Secure=true → used for the refresh token (scoped to /api/auth).
 * In development (HTTP), use unprefixed names so the browser accepts them.
 */
const isProduction = process.env.NODE_ENV === 'production'

export const ACCESS_TOKEN_COOKIE = isProduction ? '__Secure-at' : 'at'
export const REFRESH_TOKEN_COOKIE = isProduction ? '__Secure-rt' : 'rt'

/** Access token lifetime (ms) — 15 minutes */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000

/** Refresh token lifetime (ms) — 7 days */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

// --- Rate limiting ---

/** Global API rate limit window (ms) */
export const RATE_LIMIT_GLOBAL_WINDOW_MS = 60 * 1000

/** Max requests per IP in global window */
export const RATE_LIMIT_GLOBAL_MAX = 100

/** Auth endpoint rate limit window (ms) — 1 minute */
export const RATE_LIMIT_AUTH_WINDOW_MS = 60 * 1000

/** Max auth attempts per IP per window */
export const RATE_LIMIT_AUTH_MAX = 20

/** Sensitive mutation rate limit window (ms) — 1 minute */
export const RATE_LIMIT_SENSITIVE_WINDOW_MS = 60 * 1000

/** Max sensitive mutations per user per window */
export const RATE_LIMIT_SENSITIVE_MAX = 20

/** CRUD mutation rate limit window (ms) — 1 hour */
export const RATE_LIMIT_CRUD_WINDOW_MS = 60 * 60 * 1000

/** Max CRUD mutations per user per window — protects against runaway clients / abuse */
export const RATE_LIMIT_CRUD_MAX = 600

/** OTP rate limit window (ms) */
export const RATE_LIMIT_OTP_WINDOW_MS = 10 * 60 * 1000

/** Max OTP requests per IP per window */
export const RATE_LIMIT_OTP_MAX = 3

// --- CSRF ---

/** CSRF cookie name */
export const CSRF_COOKIE_NAME = 'csrf-token'

/** CSRF header name (lowercase — Express normalises headers to lowercase) */
export const CSRF_HEADER_NAME = 'x-csrf-token'

/** CSRF cookie max-age (ms) — 24 hours */
export const CSRF_COOKIE_TTL_MS = 24 * 60 * 60 * 1000

// --- Multi-business ---

/** Maximum active businesses per user */
export const MAX_BUSINESSES = 10

/** Invite code length in bytes (produces 6 hex chars) */
export const INVITE_CODE_BYTES = 3

/** Invite TTL (ms) — 48 hours */
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000

/** Maximum pending invites per business */
export const MAX_PENDING_INVITES = 20

/** Business switching rate limit window (ms) */
export const RATE_LIMIT_SWITCH_BUSINESS_WINDOW_MS = 60 * 1000

/** Max business switches per user per window */
export const RATE_LIMIT_SWITCH_BUSINESS_MAX = 10

/** Business creation rate limit window (ms) — 1 hour */
export const RATE_LIMIT_CREATE_BUSINESS_WINDOW_MS = 60 * 60 * 1000

/** Max business creations per IP per window */
export const RATE_LIMIT_CREATE_BUSINESS_MAX = 3

/** Invite acceptance rate limit window (ms) */
export const RATE_LIMIT_INVITE_WINDOW_MS = 60 * 1000

/** Max invite acceptances per IP per window */
export const RATE_LIMIT_INVITE_MAX = 5

// --- Coupon validation ---

/** Coupon validate rate limit window (ms) — 1 minute */
export const RATE_LIMIT_COUPON_VALIDATE_WINDOW_MS = 60 * 1000

/** Max coupon validation attempts per user per window */
export const RATE_LIMIT_COUPON_VALIDATE_MAX = 10

/** Coupon IP rate limit window (ms) — 1 minute */
export const RATE_LIMIT_COUPON_IP_WINDOW_MS = 60 * 1000

/** Max coupon requests per IP per window (shared across all users on that IP) */
export const RATE_LIMIT_COUPON_IP_MAX = 20

// --- OTP ---

/** OTP digit length */
export const OTP_LENGTH = 6

/** OTP validity period (ms) — 5 minutes */
export const OTP_TTL_MS = 5 * 60 * 1000

/** Max OTP verification attempts before lockout */
export const OTP_MAX_ATTEMPTS = 5

/** Cooldown between OTP resend requests (ms) — 30 seconds */
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000

// --- Replay protection ---

/** Replay nonce validity window (ms) — 5 minutes */
export const REPLAY_WINDOW_MS = 5 * 60 * 1000

/** Replay nonce cleanup interval (ms) — 60 seconds */
export const REPLAY_CLEANUP_INTERVAL_MS = 60 * 1000

// --- Captcha ---

/** CAPTCHA token validity window (ms) — 15 minutes */
export const CAPTCHA_WINDOW_MS = 15 * 60 * 1000

// --- Idempotency ---

/** Idempotency key TTL (days) */
export const IDEMPOTENCY_TTL_DAYS = 5

// --- Slow query ---

/** Slow query threshold (ms) — log queries slower than this */
export const SLOW_QUERY_THRESHOLD_MS = 500
