/**
 * WebAuthn registration — generate options + verify attestation.
 */

import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { generateChallenge, storeChallenge, consumeChallenge } from './challenge-store.js'
import { cborDecode } from './cbor.js'
import { coseToSpki } from './cose.js'
import { parseAuthData } from './authdata.js'

const RP_NAME = 'HisaabPro'

/** Resolve the Relying Party ID from env or default to localhost for dev. */
export function getRelyingPartyId(): string {
  return process.env.WEBAUTHN_RP_ID ?? 'localhost'
}

/** Generate registration options for navigator.credentials.create(). */
export function generateRegistrationOptions(userId: string, phone: string) {
  const rpId = getRelyingPartyId()
  const challenge = generateChallenge()

  storeChallenge(userId, challenge, userId)

  return {
    challenge,
    rp: { id: rpId, name: RP_NAME },
    user: {
      id: Buffer.from(userId).toString('base64url'),
      name: phone,
      displayName: phone,
    },
    pubKeyCredParams: [
      { type: 'public-key' as const, alg: -7 },   // ES256
      { type: 'public-key' as const, alg: -257 },  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform' as const,
      userVerification: 'required' as const,
      residentKey: 'preferred' as const,
    },
    timeout: 60000,
    attestation: 'none' as const,
  }
}

/** Verify registration attestation and store the credential. */
export async function verifyRegistration(
  userId: string,
  credentialId: string,
  attestationObject: string,
  clientDataJSON: string,
  deviceName?: string,
): Promise<{ id: string; credentialId: string }> {
  const rpId = getRelyingPartyId()

  // 1. Parse clientDataJSON
  const clientData = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'))

  if (clientData.type !== 'webauthn.create') {
    throw new Error('Invalid clientData type')
  }

  // 2. Verify challenge
  const stored = consumeChallenge(userId)
  if (!stored) {
    throw new Error('Challenge expired or not found')
  }
  if (clientData.challenge !== stored.challenge) {
    throw new Error('Challenge mismatch')
  }

  // 3. Decode attestationObject (CBOR)
  const attObjBuf = Buffer.from(attestationObject, 'base64url')
  const [attObj] = cborDecode(attObjBuf) as [Record<string, unknown>, number]

  const authDataBuf = attObj['authData'] as Buffer
  if (!authDataBuf) {
    throw new Error('Missing authData in attestationObject')
  }

  // 4. Parse authData
  const parsed = parseAuthData(authDataBuf)

  // 5. Verify RP ID hash
  const expectedRpIdHash = crypto.createHash('sha256').update(rpId).digest()
  if (!parsed.rpIdHash.equals(expectedRpIdHash)) {
    logger.warn('WebAuthn: RP ID hash mismatch during registration', { userId, expectedRpId: rpId })
    throw new Error('RP ID hash mismatch')
  }

  // 6. Check UP (user present) flag
  if (!(parsed.flags & 0x01)) {
    throw new Error('User presence flag not set')
  }

  // 7. Extract and convert public key
  if (!parsed.cosePublicKey) {
    throw new Error('No credential public key in authData')
  }

  const [coseMap] = cborDecode(parsed.cosePublicKey) as [Record<string, unknown>, number]
  const { spkiDer, algorithm } = coseToSpki(coseMap)
  const publicKeyB64 = spkiDer.toString('base64url')

  // 8. Verify credentialId matches
  const credIdFromAuth = parsed.credentialId?.toString('base64url')
  if (credIdFromAuth && credIdFromAuth !== credentialId) {
    logger.warn('WebAuthn: credentialId mismatch between rawId and authData', { userId })
  }

  // 9. Persist credential
  const credential = await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId,
      publicKey: publicKeyB64,
      algorithm,
      signCount: parsed.signCount,
      deviceName: deviceName ?? null,
    },
  })

  logger.info('WebAuthn: credential registered', {
    userId,
    credentialId: credentialId.slice(0, 20) + '...',
    algorithm,
    deviceName,
  })

  return { id: credential.id, credentialId: credential.credentialId }
}
