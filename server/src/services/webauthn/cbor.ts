/**
 * Minimal CBOR Parser — subset needed for WebAuthn attestationObject.
 */

export function cborDecode(buf: Buffer, offset = 0): [unknown, number] {
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
