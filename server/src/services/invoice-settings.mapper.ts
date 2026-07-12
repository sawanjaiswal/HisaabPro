/**
 * Invoice Settings — pure wire ↔ DB-enum mapper (R4, lossless both directions).
 *
 *   precision:  '1' ↔ ONE | '0.50' ↔ HALF | '0.10' ↔ TEN_PAISE | 'none' ↔ NONE
 *   method:     'round' ↔ ROUND | 'floor' ↔ FLOOR | 'ceil' ↔ CEIL
 *
 * `decimalPrecision.amount` is fixed at 2 (not stored) — echoed by the mapper.
 */

import type { RoundOffPrecision, RoundOffMethod } from '@prisma/client'
import type {
  InvoiceSettingsDTO,
  RoundOffPrecisionWire,
  RoundOffMethodWire,
} from './invoice-template/template.types.js'

const PRECISION_TO_WIRE: Record<RoundOffPrecision, RoundOffPrecisionWire> = {
  ONE: '1',
  HALF: '0.50',
  TEN_PAISE: '0.10',
  NONE: 'none',
}
const WIRE_TO_PRECISION: Record<RoundOffPrecisionWire, RoundOffPrecision> = {
  '1': 'ONE',
  '0.50': 'HALF',
  '0.10': 'TEN_PAISE',
  none: 'NONE',
}
const METHOD_TO_WIRE: Record<RoundOffMethod, RoundOffMethodWire> = {
  ROUND: 'round',
  FLOOR: 'floor',
  CEIL: 'ceil',
}
const WIRE_TO_METHOD: Record<RoundOffMethodWire, RoundOffMethod> = {
  round: 'ROUND',
  floor: 'FLOOR',
  ceil: 'CEIL',
}

/** DB row fields the mapper reads. */
export interface InvoiceSettingsRow {
  roundOffEnabled: boolean
  roundOffPrecision: RoundOffPrecision
  roundOffMethod: RoundOffMethod
  roundOffShowOnInvoice: boolean
  quantityDecimals: number
  rateDecimals: number
}

/** DB row → API DTO (wire strings). */
export function toInvoiceSettings(row: InvoiceSettingsRow): InvoiceSettingsDTO {
  return {
    roundOff: {
      enabled: row.roundOffEnabled,
      precision: PRECISION_TO_WIRE[row.roundOffPrecision],
      showOnInvoice: row.roundOffShowOnInvoice,
      method: METHOD_TO_WIRE[row.roundOffMethod],
    },
    decimalPrecision: {
      quantity: row.quantityDecimals,
      rate: row.rateDecimals,
      amount: 2,
    },
  }
}

/** DB column values for a full-replace PUT (amount ignored — fixed 2). */
export interface InvoiceSettingsColumns {
  roundOffEnabled: boolean
  roundOffPrecision: RoundOffPrecision
  roundOffMethod: RoundOffMethod
  roundOffShowOnInvoice: boolean
  quantityDecimals: number
  rateDecimals: number
}

/** API DTO (wire strings) → DB columns (inverse map). */
export function toInvoiceSettingsColumns(dto: InvoiceSettingsDTO): InvoiceSettingsColumns {
  return {
    roundOffEnabled: dto.roundOff.enabled,
    roundOffPrecision: WIRE_TO_PRECISION[dto.roundOff.precision],
    roundOffMethod: WIRE_TO_METHOD[dto.roundOff.method],
    roundOffShowOnInvoice: dto.roundOff.showOnInvoice,
    quantityDecimals: dto.decimalPrecision.quantity,
    rateDecimals: dto.decimalPrecision.rate,
  }
}
