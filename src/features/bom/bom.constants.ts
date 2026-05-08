/** BOM feature — constants */

export const BOM_PAGE_LIMIT = 20
export const BOM_MAX_COMPONENTS = 100
export const BOM_QTY_PRECISION = 3
export const BOM_NAME_MAX_LENGTH = 100

export const BOM_STOCK_STATUS = {
  OK: 'ok',
  LOW: 'low',
  INSUFFICIENT: 'insufficient',
} as const

export type BomStockStatus = typeof BOM_STOCK_STATUS[keyof typeof BOM_STOCK_STATUS]

export const EMPTY_COMPONENT_ROW = {
  id: '',
  componentProductId: '',
  componentProductName: '',
  quantity: '',
  unitId: '',
  notes: '',
}
