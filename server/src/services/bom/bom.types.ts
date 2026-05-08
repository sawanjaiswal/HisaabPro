/** BOM / Manufacturing — DTO types (no `any`) */

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

export interface BomListResult {
  data: BomSummaryDTO[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}
