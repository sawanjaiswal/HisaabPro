import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '@/context/LanguageContext'

export function createTestWrapper(opts: { router?: boolean } = {}) {
  const withRouter = opts.router ?? true
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    // LanguageProvider is not optional: any hook that surfaces a user-facing
    // string reaches for useLanguage(), which throws outside a provider.
    const tree = (
      <QueryClientProvider client={client}>
        <LanguageProvider>{children}</LanguageProvider>
      </QueryClientProvider>
    )
    return withRouter ? <MemoryRouter>{tree}</MemoryRouter> : tree
  }
}
