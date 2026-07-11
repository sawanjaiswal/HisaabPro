/** Production Run — API service layer */

import { api } from '@/lib/api'
import { PR_PAGE_LIMIT } from './production-run.constants'
import type {
  ProductionRunListResponse,
  ProductionRunDetailDTO,
  ProductionRunListFilters,
  WizardFormState,
} from './production-run.types'

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listProductionRuns(
  filters: ProductionRunListFilters,
  signal?: AbortSignal,
): Promise<ProductionRunListResponse> {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(PR_PAGE_LIMIT),
  })
  if (filters.bomId) params.set('bomId', filters.bomId)
  if (filters.status) params.set('status', filters.status)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  return api<ProductionRunListResponse>(`/production-runs?${params}`, { signal, cacheReads: true })
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getProductionRun(
  id: string,
  signal?: AbortSignal,
): Promise<ProductionRunDetailDTO> {
  return api<ProductionRunDetailDTO>(`/production-runs/${id}`, {
    signal,
    cacheReads: true,
  })
}

// ─── Execute ──────────────────────────────────────────────────────────────────

export async function executeProductionRun(
  wizard: WizardFormState,
  signal?: AbortSignal,
): Promise<ProductionRunDetailDTO> {
  const label = `Run: ${wizard.bomName} × ${wizard.quantityProduced}`
  return api<ProductionRunDetailDTO>('/production-runs', {
    method: 'POST',
    body: JSON.stringify({
      bomId: wizard.bomId,
      quantityProduced: parseFloat(wizard.quantityProduced),
      runDate: new Date(wizard.runDate).toISOString(),
      notes: wizard.notes || undefined,
    }),
    headers: {
      'X-Idempotency-Key': wizard.idempotencyKey,
    },
    signal,
    entityType: 'productionRun',
    entityLabel: label,
  })
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelProductionRun(
  id: string,
  bomName: string,
  signal?: AbortSignal,
): Promise<void> {
  await api(`/production-runs/${id}/cancel`, {
    method: 'POST',
    signal,
    entityType: 'productionRun',
    entityLabel: `Cancel: ${bomName}`,
  })
}
