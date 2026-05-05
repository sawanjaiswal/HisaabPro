/** Jobs — Constants: statuses, transitions, colours, routes */

import { ROUTES } from '@/config/routes.config'
import type { JobStatus } from './jobs.types'

export const JOB_STATUSES: readonly JobStatus[] = [
  'QUOTED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'INVOICED',
  'CANCELLED',
] as const

/**
 * Client-side mirror of server/src/services/job/helpers.ts STATUS_TRANSITIONS.
 * Must be kept in sync — unit-tested for parity in jobs.utils.spec.ts.
 */
export const STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUOTED:      ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:   ['QUOTED', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
  COMPLETED:   ['IN_PROGRESS', 'CANCELLED'],
  INVOICED:    [],
  CANCELLED:   [],
}

/** CSS token names for each status pill. Maps to var(--color-*) tokens. */
export const STATUS_COLOUR: Record<JobStatus, { bg: string; text: string }> = {
  QUOTED:      { bg: 'var(--color-gray-100)',    text: 'var(--color-gray-700)' },
  SCHEDULED:   { bg: 'var(--color-primary-50)',  text: 'var(--color-primary-700)' },
  IN_PROGRESS: { bg: 'var(--color-warning-50)',  text: 'var(--color-warning-700)' },
  COMPLETED:   { bg: 'var(--color-success-50)',  text: 'var(--color-success-700)' },
  INVOICED:    { bg: 'var(--color-secondary-50)', text: 'var(--color-secondary-700)' },
  CANCELLED:   { bg: 'var(--color-error-50)',    text: 'var(--color-error-700)' },
}

export const JOB_ROUTES = {
  LIST:   ROUTES.JOBS,
  NEW:    ROUTES.JOB_NEW,
  DETAIL: (id: string) => `/jobs/${id}`,
  EDIT:   (id: string) => `/jobs/${id}/edit`,
} as const
