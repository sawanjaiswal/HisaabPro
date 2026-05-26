import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

export function createTestWrapper(opts: { router?: boolean } = {}) {
  const withRouter = opts.router ?? true
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    const tree = <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return withRouter ? <MemoryRouter>{tree}</MemoryRouter> : tree
  }
}
