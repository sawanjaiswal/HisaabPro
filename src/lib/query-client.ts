/**
 * TanStack Query v5 client — offline-first, India-optimized.
 * Stale-while-revalidate with aggressive caching for 2G/3G.
 */

import { QueryClient, type DefaultOptions } from '@tanstack/react-query'

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 30_000,          // 30s — reuse cached data for short bursts
    gcTime: 10 * 60_000,        // 10min — keep in memory for tab switches
    retry: 2,                   // 2 retries on failure
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    refetchOnWindowFocus: true,  // Refresh when user returns to tab
    refetchOnReconnect: true,    // Refresh when network restores
    networkMode: 'offlineFirst', // Return cache even when offline
  },
  mutations: {
    retry: 0, // Offline queue handles mutation retries
    networkMode: 'offlineFirst',
  },
}

export const queryClient = new QueryClient({ defaultOptions })
