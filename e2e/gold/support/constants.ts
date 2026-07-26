/**
 * Shared constants for the gold-standard suites. See docs/E2E_TEST_PLAN.md.
 *
 * No mock data lives here — only reserved identifiers and the selectors the
 * app actually renders. Anything resembling a fixture response belongs in the
 * database (npm run e2e:seed), not in the spec.
 */

export const ROUTES = {
  LANDING: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_OTP: '/verify-otp',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  INVOICES: '/invoices',
} as const

/** Seeded by `npm run e2e:seed` — see server/prisma/e2e-seed.ts. */
export const SEEDED_OWNER_PHONE = '9000000001'
/** Guaranteed to have no account (FIX-NEW). */
export const UNREGISTERED_PHONE = '9000000099'

/**
 * FIX-FOREIGN — the neighbouring shop, seeded with fixed IDs (server/prisma/
 * e2e-seed.ts). The seeded owner has no membership in it, so any response that
 * carries these rows is a cross-tenant leak, not a test failure.
 */
export const FOREIGN = {
  phone: '9000000003',
  businessId: 'e2e-business-002',
  partyId: 'e2e-foreign-party-001',
  productId: 'e2e-foreign-product-001',
  partyName: 'Rival Secret Customer',
  productName: 'Rival Secret Product',
  businessName: 'Rival Traders',
} as const

export const VALID_PASSWORD = 'Test@12345'

/**
 * A phone no other run will collide with. Registration is not idempotent, so
 * every registration spec needs its own number or the 2nd run hits TC-REG-04's
 * duplicate path instead of its own.
 */
export function uniquePhone(): string {
  return `9${String(Date.now()).slice(-9)}`
}

/**
 * OTP digit boxes have no id, name, or aria-label — only a class. Selecting by
 * class is a smell, but inventing a testid the app doesn't render would be
 * worse. Logged as an a11y finding under TC-UI (inputs must be labelled).
 */
export const SEL = {
  otpDigit: '.auth-otp__digit',
  otpError: '.auth-otp__error',
  loginError: '.login-page__error',
} as const

/**
 * Auth cookie names, mirrored from server/src/config/security.ts. The `__Secure-`
 * prefix is production-only (it requires Secure=true, which HTTP dev cannot set),
 * so a spec that hardcoded the prefixed name would silently find nothing locally.
 */
export const COOKIES = {
  access: 'at',
  refresh: 'rt',
  csrf: 'csrf-token',
} as const
export const CSRF_HEADER = 'x-csrf-token'

/**
 * GSTINs whose mod-36 checksum actually validates (server/src/services/gstin.utils.ts).
 *
 * A GSTIN that merely matches the 15-char regex is rejected — the commonly
 * copy-pasted "27AAPFU0939F1ZV" fails the check digit. State code 27 is
 * Maharashtra, which is the seeded business's own state, so it drives the
 * intra-state CGST+SGST branch; 29 (Karnataka) drives IGST.
 */
export const GSTIN = {
  intraState: '27AAPFU0939F1ZF',
  interState: '29AAPFU0939F1Z9',
  malformed: 'NOTAGSTIN12345',
  badChecksum: '27AAPFU0939F1ZV',
} as const

/** Server-side security constants mirrored from server/src/config/security.ts. */
export const OTP_LENGTH = 6
export const OTP_MAX_ATTEMPTS = 5
export const RESEND_COOLDOWN_SECONDS = 30
