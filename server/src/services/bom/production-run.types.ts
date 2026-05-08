/** Production Run — DTO types (no `any`) */

export interface ProductionRunComponentDTO {
  componentProductId: string
  componentProductName: string
  quantityConsumed: number
  costSnapshotPaise: number
  lineTotalPaise: number
}

export interface ProductionRunSummaryDTO {
  id: string
  bomId: string
  bomName: string
  bomVersion: number
  finishedProductId: string
  finishedProductName: string
  quantityProduced: number
  runDate: string
  status: string
  totalCostPaise: number
  perUnitCostPaise: number
  createdAt: string
}

export interface ProductionRunDetailDTO extends ProductionRunSummaryDTO {
  notes: string | null
  warnings: string[]
  components: ProductionRunComponentDTO[]
  createdBy: string
  createdByName: string
}

export interface ShortfallDetail {
  productId: string
  productName: string
  required: number
  available: number
  shortfall: number
}

export interface ProductionRunListResult {
  data: ProductionRunSummaryDTO[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}
