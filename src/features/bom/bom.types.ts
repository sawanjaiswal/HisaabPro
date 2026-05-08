/** BOM feature — TypeScript types mirroring API contracts */

// ─── BOM ─────────────────────────────────────────────────────────────────────

export interface BomComponentDTO {
  id: string
  componentProductId: string
  componentProductName: string
  quantity: number
  unitId: string | null
  unitName: string | null
  notes: string | null
  currentStock: number
}

export interface BomSummaryDTO {
  id: string
  productId: string
  productName: string
  name: string
  version: number
  isActive: boolean
  isDefault: boolean
  componentCount: number
  createdAt: string
}

export interface BomDetailDTO {
  id: string
  productId: string
  productName: string
  name: string
  version: number
  isActive: boolean
  isDefault: boolean
  notes: string | null
  components: BomComponentDTO[]
  productionRunCount: number
  createdAt: string
  updatedAt: string
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface BomListResponse {
  data: BomSummaryDTO[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

export interface BomDetailResponse {
  data: BomDetailDTO
  versioned?: boolean
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface BomComponentFormRow {
  id: string          // local key for React (not server id)
  componentProductId: string
  componentProductName: string
  quantity: string    // string to allow decimal input
  unitId: string
  notes: string
}

export interface BomFormData {
  name: string
  productId: string
  productName: string
  isDefault: boolean
  isActive: boolean
  notes: string
  components: BomComponentFormRow[]
}

export interface BomListFilters {
  productId?: string
  isActive?: boolean
  page: number
}
