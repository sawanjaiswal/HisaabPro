/** Jobs — Type definitions (mirrors backend selects & schemas) */

export type JobStatus =
  | 'QUOTED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INVOICED'
  | 'CANCELLED'

export type JobItemKind = 'ITEM' | 'HOURLY'

export interface JobItem {
  id: string
  sortOrder: number
  productId: string | null
  kind: JobItemKind
  description: string
  quantity: string // Decimal serialised as string
  ratePaise: number
  discountPaise: number
  totalPaise: number
}

export interface JobListRow {
  id: string
  jobNumber: string | null
  title: string
  status: JobStatus
  partyId: string
  partyName: string
  scheduledAt: string | null
  totalPaise: number
  invoiceId: string | null
  updatedAt: string
}

export interface JobDetail extends JobListRow {
  description: string | null
  estimatedHours: number | null
  actualHours: number | null
  subtotalPaise: number
  discountPaise: number
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  items: JobItem[]
  createdAt: string
  createdBy: string
}

export interface JobListResponse {
  items: JobListRow[]
  nextCursor: string | null
}
