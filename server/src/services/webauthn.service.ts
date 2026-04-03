/**
 * WebAuthn / FIDO2 Service — Feature #59
 *
 * Passwordless biometric authentication using the WebAuthn standard.
 * Uses ONLY native Node.js crypto — no external WebAuthn libraries.
 *
 * Adapted from DudhHisaab's webauthn.service.ts.
 *
 * Supported algorithms:
 *   ES256  (COSE -7)  — ECDSA P-256 with SHA-256
 *   RS256  (COSE -257) — RSASSA-PKCS1-v1_5 with SHA-256
 */

import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'

// ============================================================
// Challenge Store (in-memory, 5-minute TTL)
// ============================================================

interface ChallengeEntry {
  challenge: string
  userId?: string
  createdAt: number
}

const challengeStore = new Map<string, ChallengeEntry>()
const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Auto-cleanup stale challenges every minute (unref so it doesn't block process exit)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of challengeStore) {
    if (now - entry.createdAt > CHALLENGE_TTL_MS) {
      challengeStore.delete(key)
    }
  }
}, 60_000).unref()

/** Generate a cryptographically random challenge (base64url-encoded 32 bytes). */
function generateChallenge(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** Store a challenge with optional userId association. */
function storeChallenge(key: string, challenge: string, userId?: string): void {
  challengeStore.set(key, { challenge, userId, createdAt: Date.now() })
  setTimeout(() => challengeStore.delete(key), CHALLENGE_TTL_MS)
}

/** Verify + consume a challenge (one-time use). Returns null if missing or expired. */
function consumeChallenge(key: string): { challenge: string; userId?: string } | null {
  const entry = challengeStore.get(key)
  if (!entry) return null

  if (Date.now() - entry.createdAt > CHALLENGE_TTL_MS) {
    challengeStore.delete(key)
    return null
  }

  challengeStore.delete(key) // one-time use
  return { challenge: entry.challenge, userId: entry.userId }
}

// ============================================================
// Minimal CBOR Parser (subset needed for WebAuthn attestationObject)
// ============================================================

function cborDecode(buf: Buffer, offset = 0): [unknown, number] {
  const initialByte = buf[offset]
  const majorType = (initialByte >> 5) & 0x07
  const additionalInfo = initialByte & 0x1f
  offset++

  let length: number

  if (additionalInfo < 24) {
    length = additionalInfo
  } else if (additionalInfo === 24) {
    length = buf[offset++]
  } else if (additionalInfo === 25) {
    length = buf.readUInt16BE(offset)
    offset += 2
  } else if (additionalInfo === 26) {
    length = buf.readUInt32BE(offset)
    offset += 4
  } else {
    throw new Error(`CBOR: unsupported additional info ${additionalInfo}`)
  }

  switch (majorType) {
    case 0: // unsigned integer
      return [length, offset]

    case 1: // negative integer
      return [-(1 + length), offset]

    case 2: { // byte string
      const bytes = buf.slice(offset, offset + length)
      return [bytes, offset + length]
    }

    case 3: { // text string
      const text = buf.toString('utf8', offset, offset + length)
      return [text, offset + length]
    }

    case 4: { // array
      const arr: unknown[] = []
      for (let i = 0; i < length; i++) {
        const [val, newOffset] = cborDecode(buf, offset)
        arr.push(val)
        offset = newOffset
      }
      return [arr, offset]
    }

    case 5: { // map
      const map: Record<string, unknown> = {}
      for (let i = 0; i < length; i++) {
        const [key, afterKey] = cborDecode(buf, offset)
        const [val, afterVal] = cborDecode(buf, afterKey)
        map[String(key)] = val
        offset = afterVal
      }
      return [map, offset]
    }

    default:
      throw new Error(`CBOR: unsupported major type ${majorType}`)
  }
}

// ============================================================
// COSE -> SPKI Conversion
// ============================================================

function derTLV(tag: number, value: Buffer): Buffer {
  const lengthBytes = derLength(value.length)
  return Buffer.concat([Buffer.from([tag]), lengthBytes, value])
}

function derLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len])
  if (len < 256) return Buffer.from([0x81, len])
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff])
}

/**
 * Convert a COSE public key (parsed from CBOR) to SPKI DER buffer.
 *
 * COSE map keys: 1=kty, 3=alg, -1=crv/n, -2=x/e, -3=y
 */
function coseToSpki(coseMap: Record<string, unknown>): { spkiDer: Buffer; algorithm: number } {
  const alg = Number(coseMap['3'])
  const kty = Number(coseMap['1'])

  if (kty === 2 && alg === -7) {
    // ES256 — ECDSA P-256
    const x = coseMap['-2'] as Buffer
    const y = coseMap['-3'] as Buffer

    if (!x || !y || x.length !== 32 || y.length !== 32) {
      throw new Error('Invalid EC public key coordinates')
    }

    const ecPoint = Buffer.concat([Buffer.from([0x04]), x, y])
    const ecOid = Buffer.from('2a8648ce3d0201', 'hex')
    const p256Oid = Buffer.from('2a8648ce3d030107', 'hex')

    const algId = derTLV(0x30, Buffer.concat([
      derTLV(0x06, ecOid),
      derTLV(0x06, p256Oid),
    ]))

    const bitString = derTLV(0x03, Buffer.concat([Buffer.from([0x00]), ecPoint]))
    const spkiDer = derTLV(0x30, Buffer.concat([algId, bitString]))
    return { spkiDer, algorithm: -7 }
  }

  if (kty === 3 && alg === -257) {
    // RS256 — RSASSA-PKCS1-v1_5
    const n = coseMap['-1'] as Buffer
    const e = coseMap['-2'] as Buffer

    if (!n || !e) throw new Error('Invalid RSA public key components')

    const nDer = n[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), n]) : n
    const eDer = e[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), e]) : e

    const rsaPubKey = derTLV(0x30, Buffer.concat([
      derTLV(0x02, nDer),
      derTLV(0x02, eDer),
    ]))

    const rsaOid = Buffer.from('2a864886f70d010101', 'hex')
    const algId = derTLV(0x30, Buffer.concat([
      derTLV(0x06, rsaOid),
      Buffer.from([0x05, 0x00]), // NULL
    ]))

    const bitString = derTLV(0x03, Buffer.concat([Buffer.from([0x00]), rsaPubKey]))
    const spkiDer = derTLV(0x30, Buffer.concat([algId, bitString]))
    return { spkiDer, algorithm: -257 }
  }

  throw new Error(`Unsupported COSE algorithm ${alg} / kty ${kty}`)
}

// ============================================================
// authData Parsing
// ============================================================

interface ParsedAuthData {
  rpIdHash: Buffer
  flags: number
  signCount: number
  credentialId?: Buffer
  cosePublicKey?: Buffer
}

function parseAuthData(authData: Buffer): ParsedAuthData {
  if (authData.length < 37) {
    throw new Error('authData too short')
  }

  const rpIdHash = authData.slice(0, 32)
  const flags = authData[32]
  const signCount = authData.readUInt32BE(33)

  // Attested credential data present when bit 6 (AT) is set
  const AT_FLAG = 0x40
  if (!(flags & AT_FLAG)) {
    return { rpIdHash, flags, signCount }
  }

  let pos = 37
  pos += 16 // skip aaguid

  const credIdLen = authData.readUInt16BE(pos)
  pos += 2

  const credentialId = authData.slice(pos, pos + credIdLen)
  pos += credIdLen

  const cosePublicKey = authData.slice(pos)

  return { rpIdHash, flags, signCount, credentialId, cosePublicKey }
}

// ============================================================
// Public API
// ============================================================

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

/** Delete a specific credential for a user. */
export async function deleteCredential(userId: string, credentialDbId: string): Promise<void> {
  await prisma.webAuthnCredential.deleteMany({
    where: { userId, id: credentialDbId },
  })
  logger.info('WebAuthn: credential deleted', { userId, credentialDbId })
}

/** List all credentials for a user. */
export async function listCredentials(userId: string) {
  return prisma.webAuthnCredential.findMany({
    where: { userId },
    select: {
      id: true,
      credentialId: true,
      deviceName: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}
