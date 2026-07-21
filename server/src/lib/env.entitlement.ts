/**
 * Entitlement JWT env helpers.
 * All optional — services degrade gracefully when keys are absent.
 */

/** RS256 private key PEM for signing entitlement JWTs. Optional. */
export function getEntitlementPrivateKey(): string | undefined {
  return process.env.ENTITLEMENT_PRIVATE_KEY
}

/** RS256 public key PEM for verifying entitlement JWTs. Optional. */
export function getEntitlementPublicKey(): string | undefined {
  return process.env.ENTITLEMENT_PUBLIC_KEY
}

/** Previous RS256 public key PEM for key rotation window. Optional. */
export function getEntitlementKeyPrev(): string | undefined {
  return process.env.ENTITLEMENT_KEY_PREV
}
