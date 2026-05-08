/** Production Run feature — TypeScript types */

export type ProductionRunStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'

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
  status: ProductionRunStatus
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

export interface ProductionRunListResponse {
  data: ProductionRunSummaryDTO[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

export interface ProductionRunDetailResponse {
  data: ProductionRunDetailDTO
  warnings: string[]
}

// ─── Wizard step ─────────────────────────────────────────────────────────────

export type WizardStep = 0 | 1 | 2 | 3

// ─── Form / wizard ────────────────────────────────────────────────────────────

export interface WizardFormState {
  /** Step 1 — BOM selection */
  bomId: string
  bomName: string
  bomVersion: number
  finishedProductId: string
  finishedProductName: string
  /** Step 2 — run details */
  quantityProduced: string
  runDate: string
  notes: string
  /** Idempotency key — generated once on wizard open */
  idempotencyKey: string
}

export interface ProductionRunListFilters {
  bomId?: string
  status?: ProductionRunStatus
  from?: string
  to?: string
  page: number
}

// ─── Stock availability (step 3 preview) ─────────────────────────────────────

export interface ComponentAvailability {
  componentProductId: string
  componentProductName: string
  required: number
  currentStock: number
  unitName: string | null
  status: 'ok' | 'low' | 'insufficient'
}
