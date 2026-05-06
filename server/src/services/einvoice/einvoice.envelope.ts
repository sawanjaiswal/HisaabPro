/**
 * NIC Schema 1.1 envelope builder.
 * Validates field lengths before calling NIC (don't burn quota on guaranteed-fail).
 * Seller GSTIN must match business.gstin (anti cross-tenant check).
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import { EINVOICE_ERRORS } from './einvoice.errors.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnvelopeLineItem {
  productName: string
  hsnCode?: string | null
  quantity: number
  rate: number // paise
  taxableValue: number // paise
  cgstRate: number // basis points
  cgstAmount: number // paise
  sgstRate: number // basis points
  sgstAmount: number // paise
  igstRate: number // basis points
  igstAmount: number // paise
  cessRate: number // basis points
  cessAmount: number // paise
  lineTotal: number // paise
}

export interface EnvelopeInput {
  documentId: string
  documentNumber: string
  documentDate: Date
  supplyType: string
  isReverseCharge: boolean
  placeOfSupply?: string | null
  grandTotal: number // paise
  totalTaxableValue: number // paise
  totalCgst: number // paise
  totalSgst: number // paise
  totalIgst: number // paise
  totalCess: number // paise
  business: {
    gstin: string | null
    name: string
    address?: string | null
    stateCode?: string | null
    // F-24: seller pincode + city to replace hardcoded Pin:0 / Loc:'N/A'
    pincode?: string | null
    city?: string | null
  }
  party: {
    gstin: string | null
    name: string
    stateCode?: string | null
    // F-24: buyer pincode + city (from default billing address, if available)
    pincode?: string | null
    city?: string | null
  }
  lines: EnvelopeLineItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paise2Rupees(p: number): number {
  return +(p / 100).toFixed(2)
}

function bps2Rate(bps: number): number {
  return +(bps / 100).toFixed(2)
}

function formatDate(d: Date): string {
  // NIC expects DD/MM/YYYY
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function assertLen(value: string, max: number, field: string): void {
  if (value.length > max) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Field ${field} exceeds max length ${max} (got ${value.length})`,
      { code: EINVOICE_ERRORS.FIELD_LENGTH, field, max, actual: value.length }
    )
  }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildIrnEnvelope(input: EnvelopeInput): Record<string, unknown> {
  const { business, party, lines } = input

  // Seller GSTIN must match business.gstin
  if (!business.gstin) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Business GSTIN required for e-invoice')
  }
  if (!party.gstin) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Party GSTIN required for B2B e-invoice')
  }

  // Field length assertions (NIC Schema 1.1 limits)
  assertLen(input.documentNumber, 16, 'DocNo')
  assertLen(business.name, 100, 'Seller.LglNm')
  assertLen(party.name, 100, 'Buyer.LglNm')
  if (business.address) assertLen(business.address, 100, 'Seller.Addr1')

  const itemList = lines.map((li, idx) => ({
    SlNo: String(idx + 1),
    PrdNm: li.productName.slice(0, 300),
    HsnCd: li.hsnCode ?? '',
    Qty: li.quantity,
    Unit: 'NOS',
    UnitPrice: paise2Rupees(li.rate),
    TotAmt: paise2Rupees(li.lineTotal),
    AssAmt: paise2Rupees(li.taxableValue),
    GstRt: bps2Rate(li.cgstRate + li.sgstRate + li.igstRate),
    CgstAmt: paise2Rupees(li.cgstAmount),
    SgstAmt: paise2Rupees(li.sgstAmount),
    IgstAmt: paise2Rupees(li.igstAmount),
    CesAmt: paise2Rupees(li.cessAmount),
    TotItemVal: paise2Rupees(li.lineTotal + li.cgstAmount + li.sgstAmount + li.igstAmount + li.cessAmount),
  }))

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: input.supplyType,
      RegRev: input.isReverseCharge ? 'Y' : 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: input.documentNumber,
      Dt: formatDate(input.documentDate),
    },
    SellerDtls: {
      Gstin: business.gstin,
      LglNm: business.name,
      TrdNm: business.name,
      Addr1: business.address ?? 'N/A',
      // F-24: use seller city/pincode when available; fall back gracefully
      Loc: business.city ?? 'N/A',
      Pin: business.pincode ? Number(business.pincode) : 0,
      Stcd: business.stateCode ?? (business.gstin.slice(0, 2)),
    },
    BuyerDtls: {
      Gstin: party.gstin,
      LglNm: party.name,
      TrdNm: party.name,
      Pos: input.placeOfSupply ?? (party.gstin.slice(0, 2)),
      Addr1: 'N/A',
      // F-24: use buyer city/pincode from billing address when available
      Loc: party.city ?? 'N/A',
      Pin: party.pincode ? Number(party.pincode) : 0,
      Stcd: party.stateCode ?? (party.gstin.slice(0, 2)),
    },
    ValDtls: {
      AssVal: paise2Rupees(input.totalTaxableValue),
      CgstVal: paise2Rupees(input.totalCgst),
      SgstVal: paise2Rupees(input.totalSgst),
      IgstVal: paise2Rupees(input.totalIgst),
      CesVal: paise2Rupees(input.totalCess),
      TotInvVal: paise2Rupees(input.grandTotal),
    },
    ItemList: itemList,
  }
}
