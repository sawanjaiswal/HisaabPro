/** Jobs API — request/response types (mirrors server schemas) */

import type { JobStatus, JobItemKind } from '../jobs.types'

export interface CreateJobItemInput {
  productId?: string | null
  kind?: JobItemKind
  description: string
  quantity: string    // decimal as string e.g. "1.000"
  ratePaise: number
  discountPaise?: number
}

export interface CreateJobInput {
  partyId: string
  title: string
  description?: string | null
  scheduledAt?: string | null
  estimatedHours?: number | null
  actualHours?: number | null
  items: CreateJobItemInput[]
  clientId?: string
}

export type UpdateJobInput = Partial<Omit<CreateJobInput, 'clientId'>>

export interface TransitionJobInput {
  toStatus: JobStatus
  reason?: string
}

export interface ListJobsQuery {
  status?: JobStatus
  partyId?: string
  q?: string
  scheduledFrom?: string
  scheduledTo?: string
  cursor?: string
  limit?: number
}
