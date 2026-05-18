import { describe, it, expect } from 'vitest'
import { scanForXxe, UNSAFE_XML } from '../xxe-prescan.js'

describe('scanForXxe', () => {
  it('passes a clean XML document', () => {
    const xml = `<?xml version="1.0"?><ENVELOPE><HEADER>ok</HEADER></ENVELOPE>`
    const res = scanForXxe(Buffer.from(xml, 'utf8'))
    expect(res.safe).toBe(true)
    expect(res.reason).toBeUndefined()
  })

  it('passes an empty buffer (no XML to scan)', () => {
    expect(scanForXxe(Buffer.alloc(0)).safe).toBe(true)
  })

  it('rejects a DOCTYPE declaration', () => {
    const xml = `<?xml version="1.0"?>\n<!DOCTYPE foo>\n<foo/>`
    const res = scanForXxe(Buffer.from(xml, 'utf8'))
    expect(res.safe).toBe(false)
    expect(res.reason).toBe(UNSAFE_XML)
  })

  it('rejects an ENTITY declaration', () => {
    const xml = `<?xml version="1.0"?>\n<!ENTITY lol "lol">\n<foo/>`
    const res = scanForXxe(Buffer.from(xml, 'utf8'))
    expect(res.safe).toBe(false)
    expect(res.reason).toBe(UNSAFE_XML)
  })

  it('rejects a CDATA section', () => {
    const xml = `<?xml version="1.0"?><foo><![CDATA[bar]]></foo>`
    expect(scanForXxe(Buffer.from(xml, 'utf8')).safe).toBe(false)
  })

  it('is case-insensitive for DOCTYPE', () => {
    expect(
      scanForXxe(Buffer.from('<!doctype html>', 'utf8')).safe,
    ).toBe(false)
  })

  // S1 adversarial: huge whitespace prefix must NOT bypass the scan.
  // Earlier drafts of this audit considered scanning only the first 64KB —
  // this test pins the SSOT that the whole buffer is scanned.
  it('rejects DOCTYPE buried behind a 100KB whitespace prefix (S1)', () => {
    const padding = ' '.repeat(100 * 1024)
    const xml = `${padding}<!DOCTYPE foo><foo/>`
    const res = scanForXxe(Buffer.from(xml, 'utf8'))
    expect(res.safe).toBe(false)
    expect(res.reason).toBe(UNSAFE_XML)
  })

  it('rejects ENTITY buried behind a 1MB junk prefix (S1)', () => {
    const padding = ' '.repeat(1024 * 1024)
    const xml = `${padding}<!ENTITY a "b">`
    expect(scanForXxe(Buffer.from(xml, 'utf8')).safe).toBe(false)
  })
})
