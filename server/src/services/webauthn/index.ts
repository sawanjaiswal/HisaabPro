/**
 * WebAuthn / FIDO2 Service — public API re-export.
 *
 * Passwordless biometric authentication using the WebAuthn standard.
 * Uses ONLY native Node.js crypto — no external WebAuthn libraries.
 *
 * Adapted from DudhHisaab's webauthn.service.ts.
 */

export { getRelyingPartyId, generateRegistrationOptions, verifyRegistration } from './registration.js'
export { generateAuthenticationOptions, verifyAuthentication } from './authentication.js'
export { deleteCredential, listCredentials } from './credentials.js'
