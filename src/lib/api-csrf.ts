import { API_URL } from '@/config/app.config'

// ─── CSRF double-submit token (fetched once, cached in memory) ──────────────

let csrfToken: string | null = null
let csrfPromise: Promise<string | null> | null = null

export async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  if (csrfPromise) return csrfPromise
  csrfPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/csrf-token`, { credentials: 'include' })
      if (!res.ok) return null
      const body = await res.json().catch(() => null) as { data?: { csrfToken?: string } } | null
      csrfToken = body?.data?.csrfToken ?? res.headers.get('x-csrf-token')
      return csrfToken
    } catch {
      return null
    } finally {
      csrfPromise = null
    }
  })()
  return csrfPromise
}

export function invalidateCsrfToken() { csrfToken = null }
