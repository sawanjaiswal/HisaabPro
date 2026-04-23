/**
 * WebAuthn authentication — generate options + verify assertion.
 */

import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { generateChallenge, storeChallenge, consumeChallenge } from './challenge-store.js'
import { parseAuthData } from './authdata.js'
import { getRelyingPartyId } from './registration.js'

/** Generate authentication options for navigator.credentials.get(). */
export async function generateAuthenticationOptions(phone: string) {
  const rpId = getRelyingPartyId()
  const challenge = generateChallenge()

  // Find user + credentials by phone
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  })

  if (!user) return null

  const credentials: Array<{ credentialId: string }> = await prisma.webAuthnCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true },
  })

  if (credentials.length === 0) return null

  storeChallenge(phone, challenge, user.id)

  return {
    challenge,
    rpId,
    timeout: 60000,
    userVerification: 'required' as const,
    allowCredentials: credentials.map((c: { credentialId: string }) => ({
      type: 'public-key' as const,
      id: c.credentialId,
    })),
  }
}

/** Verify an assertion (biometric login). Returns user info for token generation. */
export async function verifyAuthentication(
  credentialId: string,
  authenticatorData: string,
  clientDataJSON: string,
  signature: string,
  phone: string,
): Promise<{ userId: string; phone: string }> {
  const rpId = getRelyingPartyId()

  // 1. Find the credential
  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
    include: {
      user: {
        select: {
          id: true,
          phone: true,
          isActive: true,
          isSuspended: true,
          accountLockedUntil: true,
        },
      },
    },
  })

  if (!credential) {
    throw new Error('Credential not found')
  }

  const user = credential.user

  if (!user.isActive) {
    throw new Error('Account is inactive')
  }
  if (user.isSuspended) {
    throw new Error('Account is suspended')
  }
  if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
    throw new Error('Account is temporarily locked')
  }

  // 2. Parse clientDataJSON
  const clientDataBuf = Buffer.from(clientDataJSON, 'base64url')
  const clientData = JSON.parse(clientDataBuf.toString('utf8'))

  if (clientData.type !== 'webauthn.get') {
    throw new Error('Invalid clientData type')
  }

  // 3. Verify challenge
  const stored = consumeChallenge(phone)
  if (!stored) {
    throw new Error('Challenge expired or not found')
  }
  if (clientData.challenge !== stored.challenge) {
    throw new Error('Challenge mismatch')
  }

  // 4. Parse authenticatorData
  const authDataBuf = Buffer.from(authenticatorData, 'base64url')
  const parsed = parseAuthData(authDataBuf)

  // 5. Verify RP ID hash
  const expectedRpIdHash = crypto.createHash('sha256').update(rpId).digest()
  if (!parsed.rpIdHash.equals(expectedRpIdHash)) {
    logger.warn('WebAuthn: RP ID hash mismatch during login', { phone, expectedRpId: rpId })
    throw new Error('RP ID hash mismatch')
  }

  // 6. Check UP flag
  if (!(parsed.flags & 0x01)) {
    throw new Error('User presence flag not set')
  }

  // 7. Verify signature
  const clientDataHash = crypto.createHash('sha256').update(clientDataBuf).digest()
  const signedData = Buffer.concat([authDataBuf, clientDataHash])

  const spkiDer = Buffer.from(credential.publicKey, 'base64url')
  const sigBuf = Buffer.from(signature, 'base64url')

  let isValid: boolean
  try {
    if (credential.algorithm === -7) {
      // ES256 — try IEEE-P1363 first, then fall back to DER
      isValid = crypto.verify(
        'SHA256',
        signedData,
        { key: spkiDer, format: 'der', type: 'spki', dsaEncoding: 'ieee-p1363' },
        sigBuf
      )

      if (!isValid) {
        isValid = crypto.verify(
          'SHA256',
          signedData,
          { key: spkiDer, format: 'der', type: 'spki' },
          sigBuf
        )
      }
    } else if (credential.algorithm === -257) {
      // RS256
      isValid = crypto.verify(
        'SHA256',
        signedData,
        { key: spkiDer, format: 'der', type: 'spki' },
        sigBuf
      )
    } else {
      throw new Error(`Unsupported algorithm: ${credential.algorithm}`)
    }
  } catch (err) {
    logger.error('WebAuthn: signature verification error', {
      credentialId,
      error: (err as Error).message,
    })
    throw new Error('Signature verification failed')
  }

  if (!isValid) {
    logger.warn('WebAuthn: invalid signature', { userId: user.id, credentialId })
    throw new Error('Invalid signature')
  }

  // 8. Verify signCount (replay protection)
  if (parsed.signCount !== 0 && parsed.signCount <= credential.signCount) {
    logger.warn('WebAuthn: possible cloned authenticator', {
      userId: user.id,
      credentialId,
      storedCount: credential.signCount,
      receivedCount: parsed.signCount,
    })
    throw new Error('Authenticator sign count invalid - possible cloned device')
  }

  // 9. Atomically update signCount (prevents race on concurrent auth attempts)
  const updated = await prisma.webAuthnCredential.updateMany({
    where: {
      credentialId,
      signCount: { lt: parsed.signCount },
    },
    data: {
      signCount: parsed.signCount,
      lastUsedAt: new Date(),
    },
  })

  if (updated.count === 0) {
    logger.warn('WebAuthn: signCount update race — concurrent auth attempt', {
      userId: user.id,
      credentialId,
    })
  }

  logger.info('WebAuthn: assertion verified', {
    userId: user.id,
    credentialId: credentialId.slice(0, 20) + '...',
    signCount: parsed.signCount,
  })

  return { userId: user.id, phone: user.phone }
}
