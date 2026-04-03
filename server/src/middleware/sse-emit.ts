/**
 * SSE auto-emit middleware — intercepts successful mutation responses
 * and broadcasts SSE events to other clients of the same business.
 * Placed after auth middleware, covers ALL routes automatically.
 */

import type { Request, Response, NextFunction } from 'express'
import { emitMutationEvent } from '../services/sse.service.js'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Infer entity type from API path: /api/parties/abc → PARTY */
function inferEntityType(path: string): string {
  const segments = path.replace(/^\/api\//, '').split('/')
  const resource = segments[0] ?? 'UNKNOWN'
  // Singularize: "parties" → "PARTY", "documents" → "DOCUMENT"
  let singular = resource.toUpperCase()
  if (singular.endsWith('IES')) singular = singular.slice(0, -3) + 'Y'
  else if (singular.endsWith('ES') && !singular.endsWith('SSES')) singular = singular.slice(0, -2)
  else if (singular.endsWith('S') && !singular.endsWith('SS')) singular = singular.slice(0, -1)
  return singular
}

/** Infer mutation action from HTTP method */
function inferAction(method: string): 'CREATED' | 'UPDATED' | 'DELETED' {
  if (method === 'POST') return 'CREATED'
  if (method === 'DELETE') return 'DELETED'
  return 'UPDATED'
}

/**
 * Wraps res.json to emit SSE events after successful mutations.
 * No-op for GET requests and failed responses.
 */
export function sseAutoEmit(req: Request, res: Response, next: NextFunction) {
  if (!MUTATION_METHODS.has(req.method)) return next()

  const originalJson = res.json.bind(res)

  res.json = function sseInterceptedJson(body: unknown) {
    // Only emit for successful mutations by authenticated users
    const parsed = body as { success?: boolean; data?: { id?: string } } | null
    if (parsed?.success && req.user?.businessId) {
      const entityType = inferEntityType(req.path)
      const action = inferAction(req.method)
      const entityId = parsed.data?.id ?? ''

      // Fire-and-forget — never delay the response
      emitMutationEvent(req.user.businessId, entityType, action, entityId, req.user.userId)
    }

    return originalJson(body)
  }

  next()
}
