/**
 * COSE → SPKI DER conversion.
 *
 * Supported algorithms:
 *   ES256  (COSE -7)   — ECDSA P-256 with SHA-256
 *   RS256  (COSE -257) — RSASSA-PKCS1-v1_5 with SHA-256
 *
 * COSE map keys: 1=kty, 3=alg, -1=crv/n, -2=x/e, -3=y
 */

function derTLV(tag: number, value: Buffer): Buffer {
  const lengthBytes = derLength(value.length)
  return Buffer.concat([Buffer.from([tag]), lengthBytes, value])
}

function derLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len])
  if (len < 256) return Buffer.from([0x81, len])
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff])
}

export function coseToSpki(coseMap: Record<string, unknown>): { spkiDer: Buffer; algorithm: number } {
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
