/**
 * Compatibility re-export — delegates to the split webauthn/ directory.
 * The biometric route imports this path; keeping it avoids touching the route.
 */
export * from './webauthn/index.js'
