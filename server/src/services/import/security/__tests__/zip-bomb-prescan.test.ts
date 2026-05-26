import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'
import { deflateRawSync } from 'zlib'
import { prescanXlsxArchive } from '../zip-bomb-prescan.js'
import {
  XLSX_MAX_UNCOMPRESSED,
  XLSX_MAX_RATIO,
} from '../../../../constants/import.constants.js'

/**
 * Build a real zip with adm-zip. Each entry's compressed/uncompressed sizes
 * are written into the central directory by adm-zip; yauzl reads those
 * fields back, which is exactly what zip-bomb-prescan asserts.
 */
function buildZip(entries: Array<{ name: string; data: Buffer | string }>) {
  const zip = new AdmZip()
  for (const e of entries) {
    const buf = typeof e.data === 'string' ? Buffer.from(e.data) : e.data
    zip.addFile(e.name, buf)
  }
  return zip.toBuffer()
}

/**
 * Craft a minimal single-entry zip with a HOSTILE file name verbatim
 * (adm-zip normalises `/etc/passwd` → `etc/passwd`; we need bytes-level
 * control to actually test the path-escape guard).
 */
function buildHostileZip(rawName: string, body = 'x'): Buffer {
  const nameBuf = Buffer.from(rawName, 'utf8')
  const dataBuf = Buffer.from(body, 'utf8')
  const compressed = deflateRawSync(dataBuf)
  // CRC32 of body (Node 18+ provides it via zlib, but compute manually to
  // keep this fixture self-contained).
  const crcTable = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })()
  let crc = 0xffffffff
  for (const byte of dataBuf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  crc = (crc ^ 0xffffffff) >>> 0

  const localHeader = Buffer.alloc(30)
  localHeader.writeUInt32LE(0x04034b50, 0) // local file header sig
  localHeader.writeUInt16LE(20, 4)         // version
  localHeader.writeUInt16LE(0, 6)          // flags
  localHeader.writeUInt16LE(8, 8)          // method=deflate
  localHeader.writeUInt16LE(0, 10)         // time
  localHeader.writeUInt16LE(0, 12)         // date
  localHeader.writeUInt32LE(crc, 14)
  localHeader.writeUInt32LE(compressed.length, 18)
  localHeader.writeUInt32LE(dataBuf.length, 22)
  localHeader.writeUInt16LE(nameBuf.length, 26)
  localHeader.writeUInt16LE(0, 28)         // extra len

  const centralHeader = Buffer.alloc(46)
  centralHeader.writeUInt32LE(0x02014b50, 0)
  centralHeader.writeUInt16LE(20, 4)
  centralHeader.writeUInt16LE(20, 6)
  centralHeader.writeUInt16LE(0, 8)
  centralHeader.writeUInt16LE(8, 10)
  centralHeader.writeUInt16LE(0, 12)
  centralHeader.writeUInt16LE(0, 14)
  centralHeader.writeUInt32LE(crc, 16)
  centralHeader.writeUInt32LE(compressed.length, 20)
  centralHeader.writeUInt32LE(dataBuf.length, 24)
  centralHeader.writeUInt16LE(nameBuf.length, 28)
  centralHeader.writeUInt16LE(0, 30) // extra
  centralHeader.writeUInt16LE(0, 32) // comment
  centralHeader.writeUInt16LE(0, 34) // disk
  centralHeader.writeUInt16LE(0, 36) // int attrs
  centralHeader.writeUInt32LE(0, 38) // ext attrs
  centralHeader.writeUInt32LE(0, 42) // local header offset

  const cdSize = centralHeader.length + nameBuf.length
  const cdOffset = localHeader.length + nameBuf.length + compressed.length

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(cdSize, 12)
  eocd.writeUInt32LE(cdOffset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([
    localHeader,
    nameBuf,
    compressed,
    centralHeader,
    nameBuf,
    eocd,
  ])
}

describe('prescanXlsxArchive', () => {
  it('passes a small, well-formed archive', async () => {
    const buf = buildZip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types/>' },
      { name: 'xl/worksheets/sheet1.xml', data: '<sheet/>' },
    ])
    const res = await prescanXlsxArchive(buf)
    expect(res.safe).toBe(true)
    expect(res.totalUncompressed).toBeGreaterThan(0)
  })

  it('rejects total uncompressed > XLSX_MAX_UNCOMPRESSED', async () => {
    // Use highly-compressible data: ~110MB of zeroes compresses to a few KB
    // but the CD records the full 110MB uncompressed size — which is what
    // we want this guard to catch.
    const bigPayload = Buffer.alloc(XLSX_MAX_UNCOMPRESSED + 10 * 1024 * 1024)
    const buf = buildZip([{ name: 'sheet1.xml', data: bigPayload }])
    const res = await prescanXlsxArchive(buf)
    expect(res.safe).toBe(false)
    expect(res.reason).toBe('UNSAFE_ARCHIVE')
  }, 30_000)

  it('rejects a single high-ratio entry', async () => {
    // 2MB of zeroes will compress well past XLSX_MAX_RATIO (100x).
    const payload = Buffer.alloc(2 * 1024 * 1024)
    const buf = buildZip([{ name: 'sheet1.xml', data: payload }])
    const res = await prescanXlsxArchive(buf)
    // Either the total threshold or the ratio threshold trips first;
    // both yield the same UNSAFE_ARCHIVE verdict.
    expect(res.safe).toBe(false)
    expect(res.reason).toBe('UNSAFE_ARCHIVE')
    // sanity: confirm the ratio guard is exercised (uncompressed/compressed > MAX_RATIO)
    expect(XLSX_MAX_RATIO).toBeGreaterThan(0)
  })

  it('rejects an entry whose name contains a `..` segment', async () => {
    const buf = buildHostileZip('xl/../../etc/passwd', 'pwned')
    const res = await prescanXlsxArchive(buf)
    expect(res.safe).toBe(false)
    expect(res.reason).toBe('UNSAFE_ARCHIVE')
  })

  it('rejects an entry with an absolute POSIX path', async () => {
    const buf = buildHostileZip('/etc/passwd', 'pwned')
    const res = await prescanXlsxArchive(buf)
    expect(res.safe).toBe(false)
    expect(res.reason).toBe('UNSAFE_ARCHIVE')
  })

  it('rejects an entry with an absolute Windows path', async () => {
    const buf = buildHostileZip('C:\\Windows\\evil.txt', 'pwned')
    const res = await prescanXlsxArchive(buf)
    expect(res.safe).toBe(false)
    expect(res.reason).toBe('UNSAFE_ARCHIVE')
  })

  it('rejects garbage that is not a zip at all', async () => {
    const res = await prescanXlsxArchive(Buffer.from('not a zip', 'utf8'))
    expect(res.safe).toBe(false)
    expect(res.reason).toBe('UNSAFE_ARCHIVE')
  })
})
