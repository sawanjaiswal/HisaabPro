/**
 * GSTR-3B CSV generator — converts 11-section summary to CSV string.
 * Rupee amounts expected (already converted from paise at export boundary).
 */

import type { Gstr3bSummary } from './gstr3b.service.js'

export function generateGstr3bCsv(summary: Gstr3bSummary): string {
  const header = 'Section,Description,Taxable Value,CGST,SGST,IGST,Cess'
  const rows = summary.sections.map(s =>
    [
      s.section,
      `"${s.description}"`,
      s.taxableValue.toFixed(2),
      s.cgst.toFixed(2),
      s.sgst.toFixed(2),
      s.igst.toFixed(2),
      s.cess.toFixed(2),
    ].join(',')
  )
  const footer = `Net Payable,,${summary.netPayable.toFixed(2)},,,, `
  return [header, ...rows, footer].join('\n')
}
