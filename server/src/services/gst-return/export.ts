/**
 * GSTR-1 JSON export in (simplified) government format.
 */

import { generateGstr1 } from './gstr1.js'
import { formatDateDDMMYYYY } from './helpers.js'

export async function exportGstr1Json(businessId: string, period: string) {
  const data = await generateGstr1(businessId, period)

  // Government GSTR-1 JSON structure (simplified — real format has more fields)
  const json = {
    gstin: '', // filled by caller from business settings
    fp: period.replace('-', ''), // MMYYYY format
    b2b: data.b2b.map((d) => ({
      ctin: d.party.gstin,
      inv: [{
        inum: d.documentNumber,
        idt: formatDateDDMMYYYY(d.documentDate),
        val: d.grandTotal / 100,
        pos: d.placeOfSupply,
        rchrg: d.isReverseCharge ? 'Y' : 'N',
        itms: d.lineItems.map((li) => ({
          num: 0,
          itm_det: {
            txval: li.taxableValue / 100,
            camt: li.cgstAmount / 100,
            samt: li.sgstAmount / 100,
            iamt: li.igstAmount / 100,
            csamt: li.cessAmount / 100,
          },
        })),
      }],
    })),
    b2cl: data.b2cl.map((d) => ({
      pos: d.placeOfSupply,
      inv: [{
        inum: d.documentNumber,
        idt: formatDateDDMMYYYY(d.documentDate),
        val: d.grandTotal / 100,
        itms: d.lineItems.map((li) => ({
          num: 0,
          itm_det: { txval: li.taxableValue / 100, iamt: li.igstAmount / 100, csamt: li.cessAmount / 100 },
        })),
      }],
    })),
    hsn: {
      data: data.hsn.map((h) => ({
        hsn_sc: h.hsnCode,
        qty: h.qty,
        txval: h.taxable / 100,
        camt: h.cgst / 100,
        samt: h.sgst / 100,
        iamt: h.igst / 100,
        csamt: h.cess / 100,
      })),
    },
  }

  return {
    json,
    fileName: `GSTR1_${period}.json`,
    summary: data.summary,
  }
}
