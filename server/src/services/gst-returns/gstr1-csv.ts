/**
 * GSTR-1 CSV Generator.
 * Accepts the NIC rupee envelope (post paiseToRupeesForNic conversion).
 * Produces a multi-section CSV matching NIC offline tool format.
 */

import type { Gstr1Envelope } from './gstr1.service.js'

function esc(v: unknown): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
}

function row(...cols: unknown[]): string {
  return cols.map(esc).join(',')
}

export function generateGstr1Csv(env: Gstr1Envelope): string {
  const lines: string[] = []

  // Header
  lines.push(row('GSTIN', 'Filing Period', 'Grand Total', 'Current GT'))
  lines.push(row(env.gstin, env.fp, env.gt, env.cur_gt))
  lines.push('')

  // B2B
  lines.push('B2B - Invoices of registered counterparties')
  lines.push(row('GSTIN of Recipient', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Invoice Type', 'Taxable Value', 'Rate', 'CGST', 'SGST', 'IGST', 'Cess'))
  for (const entry of env.b2b) {
    for (const inv of entry.inv) {
      for (const itm of inv.itms) {
        lines.push(row(entry.ctin, inv.inum, inv.idt, inv.val, inv.pos, inv.rchrg, inv.inv_typ, itm.itm_det.txval, itm.itm_det.rt, itm.itm_det.camt, itm.itm_det.samt, itm.itm_det.iamt, itm.itm_det.csamt))
      }
    }
  }
  lines.push('')

  // B2CL
  lines.push('B2CL - Large B2C invoices')
  lines.push(row('Place of Supply', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Taxable Value', 'Rate', 'IGST', 'Cess'))
  for (const entry of env.b2cl) {
    for (const inv of entry.inv) {
      for (const itm of inv.itms) {
        lines.push(row(entry.pos, inv.inum, inv.idt, inv.val, itm.itm_det.txval, itm.itm_det.rt, itm.itm_det.iamt, itm.itm_det.csamt))
      }
    }
  }
  lines.push('')

  // B2CS
  lines.push('B2CS - Small B2C aggregated')
  lines.push(row('Supply Type', 'Place of Supply', 'Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Cess'))
  for (const entry of env.b2cs) {
    lines.push(row(entry.sply_ty, entry.pos, entry.rt, entry.txval, entry.camt, entry.samt, entry.iamt, entry.csamt))
  }
  lines.push('')

  // CDNR
  lines.push('CDNR - Credit/Debit notes to registered')
  lines.push(row('GSTIN of Recipient', 'Note Type', 'Note Number', 'Note Date', 'Note Value', 'Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Cess'))
  for (const entry of env.cdnr) {
    for (const nt of entry.nt) {
      for (const itm of nt.itms) {
        lines.push(row(entry.ctin, nt.ntty, nt.nt_num, nt.nt_dt, nt.val, itm.itm_det.rt, itm.itm_det.txval, itm.itm_det.camt, itm.itm_det.samt, itm.itm_det.iamt, itm.itm_det.csamt))
      }
    }
  }
  lines.push('')

  // CDNUR
  lines.push('CDNUR - Credit/Debit notes to unregistered')
  lines.push(row('UR Type', 'Note Type', 'Note Number', 'Note Date', 'Note Value', 'Rate', 'Taxable Value', 'IGST', 'Cess'))
  for (const entry of env.cdnur) {
    for (const itm of entry.itms) {
      lines.push(row(entry.typ, entry.ntty, entry.nt_num, entry.nt_dt, entry.val, itm.itm_det.rt, itm.itm_det.txval, itm.itm_det.iamt, itm.itm_det.csamt))
    }
  }
  lines.push('')

  // HSN
  lines.push('HSN Summary')
  lines.push(row('HSN/SAC', 'UQC', 'Rate', 'Quantity', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Cess'))
  for (const h of env.hsn.data) {
    lines.push(row(h.hsn_sc, h.uqc, h.rt, h.qty, h.txval, h.camt, h.samt, h.iamt, h.csamt))
  }
  lines.push('')

  // NIL
  lines.push('NIL - Nil-rated / Exempt')
  lines.push(row('Supply Type', 'Nil Amount', 'Exempt Amount', 'Non-GST Amount'))
  for (const n of env.nil.inv) {
    lines.push(row(n.sply_ty, n.nil_amt, n.expt_amt, n.ngsup_amt))
  }
  lines.push('')

  // EXP
  lines.push('EXP - Export invoices')
  lines.push(row('Export Type', 'Invoice Number', 'Invoice Date', 'Invoice Value'))
  for (const entry of env.exp) {
    for (const inv of entry.inv) {
      lines.push(row(entry.exp_typ, inv.inum, inv.idt, inv.val))
    }
  }

  return lines.join('\n')
}
