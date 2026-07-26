/**
 * The seam between a parser and the normalizer.
 *
 * Both halves had unit tests and both passed while every real Vyapar / Tally /
 * Busy import produced 100% "Name is required" rows: the normalizer's tests fed
 * it hand-written source-header rows that no parser emits. These cases run the
 * REAL parser and hand its REAL output to the normalizer, which is the only
 * arrangement that can catch a renamed key on the way through.
 */

import { describe, it, expect } from 'vitest'
import { vyaparCsvParser } from '../../parsers/vyapar-csv.parser.js'
import { tallyXmlParser } from '../../parsers/tally-xml.parser.js'
import { normalizePartyRow } from '../party-normalizer.js'
import { defaultMappingFor } from '../normalize-mappings.js'

const ctx = { fileName: 'test', businessId: 'biz-1' } as never

describe('parser → normalizer seam', () => {
  it('a Vyapar row keeps its name through the mapping', async () => {
    const csv = [
      'Party Name,Phone Number,Email,GSTIN,Address,Opening Balance',
      'Raju Traders,9111111111,raju@traders.in,27AAPFU0939F1ZV,MG Road,1000',
    ].join('\n')

    const parsed = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(parsed.rows).toHaveLength(1)

    const out = normalizePartyRow(parsed.rows[0]!, defaultMappingFor('VYAPAR_CSV')!)
    expect(out.issues.map((i) => i.code)).not.toContain('MISSING_NAME')
    expect(out.name).toBe('Raju Traders')
    expect(out.phone).toBe('9111111111')
    expect(out.gstin).toBe('27AAPFU0939F1ZV')
  })

  it('a Tally ledger keeps its name through the mapping', async () => {
    const xml = `<ENVELOPE><BODY><DATA><TALLYMESSAGE>
      <LEDGER NAME="Priya Wholesale">
        <PARENT>Sundry Debtors</PARENT>
        <LEDPHONE>9222222222</LEDPHONE>
      </LEDGER>
    </TALLYMESSAGE></DATA></BODY></ENVELOPE>`

    const parsed = await tallyXmlParser(Buffer.from(xml, 'utf8'), ctx)
    expect(parsed.rows.length).toBeGreaterThan(0)

    const out = normalizePartyRow(parsed.rows[0]!, defaultMappingFor('TALLY_XML')!)
    expect(out.issues.map((i) => i.code)).not.toContain('MISSING_NAME')
    expect(out.name).toBe('Priya Wholesale')
  })
})
