/**
 * GSTR-1 Service — Orchestrates 8 NIC table builders.
 * Assembles NIC v3.0 envelope, converts paise → rupees at export boundary,
 * generates CSV, and upserts GstReturn row.
 *
 * TODO: NIC JSON Schema validation with ajv is skipped (requires ~3MB gstr1-v3.schema.json).
 *       Add `validateAgainstGstr1Schema(envelope)` once schema file is available.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { buildB2b, type NicB2BEntry } from './builders/b2b.builder.js'
import { buildB2cl, type NicB2CLEntry } from './builders/b2cl.builder.js'
import { buildB2cs, type NicB2CSEntry } from './builders/b2cs.builder.js'
import { buildCdnr, type NicCdnrEntry } from './builders/cdnr.builder.js'
import { buildCdnur, type NicCdnurEntry } from './builders/cdnur.builder.js'
import { buildHsn, type NicHsnEntry } from './builders/hsn.builder.js'
import { buildNil, type NicNilInv } from './builders/nil.builder.js'
import { buildExp, type NicExpEntry } from './builders/exp.builder.js'
import { toNicFp } from './period.utils.js'
import { generateGstr1Csv } from './gstr1-csv.js'

export interface Gstr1Envelope {
  gstin: string
  fp: string            // MMYYYY
  gt: number            // grand total turnover
  cur_gt: number        // current GT (same as gt in v7)
  b2b: NicB2BEntry[]
  b2cl: NicB2CLEntry[]
  b2cs: NicB2CSEntry[]
  cdnr: NicCdnrEntry[]
  cdnur: NicCdnurEntry[]
  hsn: { data: NicHsnEntry[] }
  nil: { inv: NicNilInv[] }
  exp: NicExpEntry[]
}

export interface Gstr1Summary {
  period: string
  b2b: number
  b2cl: number
  b2cs: number
  cdnr: number
  cdnur: number
  hsn: number
  nil: number
  exp: number
}

export interface Gstr1Result {
  jsonData: Gstr1Envelope
  csvData: string
  summary: Gstr1Summary
}

/**
 * Recursively divides all numeric fields representing amounts by 100.
 * Applied ONCE at export boundary — converts paise → rupees for NIC format.
 * Skips known non-amount fields: fp, gstin, uqc, sply_ty, typ, pos, rchrg,
 * inv_typ, ntty, exp_typ, hsn_sc, inum, idt, nt_num, nt_dt, rt, qty, num.
 */
const SKIP_KEYS = new Set([
  'fp', 'gstin', 'uqc', 'sply_ty', 'typ', 'pos', 'rchrg',
  'inv_typ', 'ntty', 'exp_typ', 'hsn_sc', 'inum', 'idt',
  'nt_num', 'nt_dt', 'ctin', 'rt', 'qty', 'num', 'sbpcode',
  'sbnum', 'sbdt', 'etin',
])

export function paiseToRupeesForNic(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(paiseToRupeesForNic)
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = SKIP_KEYS.has(k) ? v : paiseToRupeesForNic(v)
    }
    return out
  }
  if (typeof obj === 'number') return Math.round(obj) / 100
  return obj
}

export async function exportGstr1(
  businessId: string,
  period: string,
): Promise<Gstr1Result> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { gstin: true },
  })

  logger.info('gstr1.export.started', { businessId, period })

  // Run all 8 builders in parallel
  const [b2b, b2cl, b2cs, cdnr, cdnur, hsn, nil, exp] = await Promise.all([
    buildB2b(prisma, businessId, period),
    buildB2cl(prisma, businessId, period),
    buildB2cs(prisma, businessId, period),
    buildCdnr(prisma, businessId, period),
    buildCdnur(prisma, businessId, period),
    buildHsn(prisma, businessId, period),
    buildNil(prisma, businessId, period),
    buildExp(prisma, businessId, period),
  ])

  // Compute grand total (sum of all taxable values in paise across non-nil tables)
  const gt = b2b.reduce((s, e) => s + e.inv.reduce((si, i) => si + i.itms.reduce((sti, it) => sti + it.itm_det.txval, 0), 0), 0)
    + b2cl.reduce((s, e) => s + e.inv.reduce((si, i) => si + i.itms.reduce((sti, it) => sti + it.itm_det.txval, 0), 0), 0)
    + b2cs.reduce((s, e) => s + e.txval, 0)

  // Assemble paise envelope
  const paiseEnvelope: Gstr1Envelope = {
    gstin: business?.gstin ?? '',
    fp: toNicFp(period),
    gt,
    cur_gt: gt,
    b2b, b2cl, b2cs, cdnr, cdnur,
    hsn: { data: hsn },
    nil: { inv: nil },
    exp,
  }

  // Convert paise → rupees at export boundary
  const rupeEnvelope = paiseToRupeesForNic(paiseEnvelope) as Gstr1Envelope

  const csvData = generateGstr1Csv(rupeEnvelope)

  const summary: Gstr1Summary = {
    period,
    b2b: b2b.length,
    b2cl: b2cl.length,
    b2cs: b2cs.length,
    cdnr: cdnr.length,
    cdnur: cdnur.length,
    hsn: hsn.length,
    nil: nil.length,
    exp: exp.length,
  }

  // Upsert GstReturn record
  const totalInvoices = b2b.reduce((s, e) => s + e.inv.length, 0)
    + b2cl.reduce((s, e) => s + e.inv.length, 0)

  await prisma.gstReturn.upsert({
    where: { businessId_period_returnType: { businessId, period, returnType: 'GSTR1' } },
    create: {
      businessId,
      period,
      returnType: 'GSTR1',
      status: 'EXPORTED',
      jsonData: rupeEnvelope as object,
      summary: summary as object,
      invoiceCount: totalInvoices,
      totalTaxableValue: gt,
    },
    update: {
      status: 'EXPORTED',
      jsonData: rupeEnvelope as object,
      summary: summary as object,
      invoiceCount: totalInvoices,
      totalTaxableValue: gt,
      updatedAt: new Date(),
    },
  })

  logger.info('gstr1.export.complete', { businessId, period, summary })

  return { jsonData: rupeEnvelope, csvData, summary }
}

export async function getGstr1Summary(
  businessId: string,
  period: string,
): Promise<{ summary: Gstr1Summary | null; exportedAt: Date | null }> {
  const existing = await prisma.gstReturn.findUnique({
    where: { businessId_period_returnType: { businessId, period, returnType: 'GSTR1' } },
    select: { summary: true, updatedAt: true },
  })

  if (!existing) return { summary: null, exportedAt: null }

  return {
    summary: existing.summary as unknown as Gstr1Summary,
    exportedAt: existing.updatedAt,
  }
}
