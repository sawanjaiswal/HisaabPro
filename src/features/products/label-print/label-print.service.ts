/** Label Print Service — fetchLabelData via api() helper */

import { api } from '@/lib/api'
import type { LabelTemplate, LabelDataResponse } from './label-print.types'

/**
 * Fetch label data for a set of product IDs.
 * Offline behaviour: api() queues the POST and returns {} — dialog detects
 * empty labels array and shows the offline error state.
 */
export async function fetchLabelData(
  productIds: string[],
  template?: LabelTemplate,
): Promise<LabelDataResponse> {
  return api<LabelDataResponse>('/products/label-data', {
    method: 'POST',
    body: JSON.stringify({ productIds, template }),
    entityType: 'label',
    entityLabel: 'Label print job',
  })
}
