/** Jobs API — all calls via api() from @/lib/api */

import { api } from '@/lib/api'
import type { JobDetail, JobListResponse } from '../jobs.types'
import type {
  CreateJobInput,
  UpdateJobInput,
  TransitionJobInput,
  ListJobsQuery,
} from './jobs.api.types'

function buildQuery(params: ListJobsQuery): string {
  const p = new URLSearchParams()
  if (params.status)        p.set('status', params.status)
  if (params.partyId)       p.set('partyId', params.partyId)
  if (params.q)             p.set('q', params.q)
  if (params.scheduledFrom) p.set('scheduledFrom', params.scheduledFrom)
  if (params.scheduledTo)   p.set('scheduledTo', params.scheduledTo)
  if (params.cursor)        p.set('cursor', params.cursor)
  if (params.limit)         p.set('limit', String(params.limit))
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}

export async function listJobs(query: ListJobsQuery = {}): Promise<JobListResponse> {
  return api<JobListResponse>(`/jobs${buildQuery(query)}`)
}

export async function getJob(id: string): Promise<JobDetail> {
  return api<JobDetail>(`/jobs/${id}`)
}

export async function createJob(data: CreateJobInput): Promise<JobDetail> {
  return api<JobDetail>('/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: 'job',
    entityLabel: data.title,
  })
}

export async function updateJob(id: string, data: UpdateJobInput, title: string): Promise<JobDetail> {
  return api<JobDetail>(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    entityType: 'job',
    entityLabel: title,
  })
}

export async function transitionJob(
  id: string,
  data: TransitionJobInput,
  title: string,
): Promise<JobDetail> {
  return api<JobDetail>(`/jobs/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: 'job',
    entityLabel: title,
  })
}

export async function convertJobToInvoice(id: string, title: string): Promise<{ id: string }> {
  return api<{ id: string }>(`/jobs/${id}/convert-to-invoice`, {
    method: 'POST',
    body: JSON.stringify({}),
    entityType: 'job',
    entityLabel: title,
  })
}

export async function deleteJob(id: string, title: string): Promise<void> {
  await api<void>(`/jobs/${id}`, {
    method: 'DELETE',
    entityType: 'job',
    entityLabel: title,
  })
}
