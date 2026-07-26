/**
 * Every line of the file has to survive to the preview.
 *
 * Counts are the shopkeeper's only reconciliation: "500 rows, 498 imported, 2
 * errors" is recoverable, "498 imported" against a file they believe holds 500
 * is a customer who quietly does not exist. A parser that drops a row for a
 * missing name deletes the evidence before the preview can show it — the
 * normalizer is the layer that judges a row, and it already classifies a
 * nameless one as MISSING_NAME.
 *
 * What the parsers MAY still exclude is anything that is not a party at all:
 * Vyapar's non-party `Type` values and Tally's non-party ledger groups.
 */

import { describe, it, expect } from 'vitest'
import { vyaparCsvParser } from '../vyapar-csv.parser.js'
import { tallyXmlParser } from '../tally-xml.parser.js'
import { normalizePartyRow } from '../../normalizers/party-normalizer.js'
import { defaultMappingFor } from '../../normalizers/normalize-mappings.js'

const ctx = { fileName: 'test', businessId: 'biz-1' } as never

describe('parsers keep every row the file contains', () => {
  it('a Vyapar row with no name is kept and flagged, not dropped', async () => {
    const csv = [
      'Party Name,Phone Number',
      'Raju Traders,9111111111',
      ',9222222222',
      'Priya Wholesale,9333333333',
    ].join('\n')

    const parsed = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(parsed.rows, 'all three lines reach the preview').toHaveLength(3)

    const nameless = parsed.rows[1]!
    const out = normalizePartyRow(nameless, defaultMappingFor('VYAPAR_CSV')!)
    expect(out.issues.map((i) => i.code)).toContain('MISSING_NAME')
  })

  it('a Vyapar row that is not a party at all is still excluded', async () => {
    const csv = [
      'Party Name,Phone Number,Type',
      'Raju Traders,9111111111,Customer',
      'Bank Charges,,Expense',
    ].join('\n')

    const parsed = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(parsed.rows, 'an expense ledger is not a customer').toHaveLength(1)
  })

  it('a Tally ledger with no name is kept and flagged', async () => {
    const xml = `<ENVELOPE><BODY><DATA><TALLYMESSAGE>
      <LEDGER NAME="Priya Wholesale"><PARENT>Sundry Debtors</PARENT></LEDGER>
      <LEDGER NAME=""><PARENT>Sundry Debtors</PARENT><LEDPHONE>9222222222</LEDPHONE></LEDGER>
    </TALLYMESSAGE></DATA></BODY></ENVELOPE>`

    const parsed = await tallyXmlParser(Buffer.from(xml, 'utf8'), ctx)
    expect(parsed.rows).toHaveLength(2)
    const out = normalizePartyRow(parsed.rows[1]!, defaultMappingFor('TALLY_XML')!)
    expect(out.issues.map((i) => i.code)).toContain('MISSING_NAME')
  })
})
