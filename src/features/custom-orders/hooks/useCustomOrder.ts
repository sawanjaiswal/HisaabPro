/** useCustomOrder — query for a single custom order detail */

import { useQuery } from '@tanstack/react-query'
import { getCustomOrder } from '../api/custom-orders.api'
import { orderQueryKeys } from './useCustomOrders'

export function useCustomOrder(id: string) {
  return useQuery({
    queryKey: orderQueryKeys.detail(id),
    queryFn: () => getCustomOrder(id),
    enabled: Boolean(id),
  })
}
