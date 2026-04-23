/**
 * WebAuthn authenticatorData parsing.
 */

export interface ParsedAuthData {
  rpIdHash: Buffer
  flags: number
  signCount: number
  credentialId?: Buffer
  cosePublicKey?: Buffer
}

export function parseAuthData(authData: Buffer): ParsedAuthData {
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
