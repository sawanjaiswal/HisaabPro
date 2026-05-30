/**
 * Log redaction — strips PII fields from log payloads before they hit Winston.
 *
 * Per security audit (M3): clinic notes are plaintext at rest (MVP) but MUST
 * NEVER reach Winston/Sentry/console. Callers that log appointment payloads
 * MUST pass them through `redactPiiFields(['notes'])` first.
 */

const REDACTED = '[REDACTED]'

export function redactPiiFields<T>(fields: string[]) {
  const set = new Set(fields)
  return (input: T): T => {
    return redact(input, set, 0) as T
  }
}

function redact(node: unknown, fields: Set<string>, depth: number): unknown {
  if (depth > 6) return node
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) return node.map((v) => redact(v, fields, depth + 1))
  if (typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (fields.has(k)) {
        out[k] = v === null || v === undefined ? v : REDACTED
      } else {
        out[k] = redact(v, fields, depth + 1)
      }
    }
    return out
  }
  return node
}

/** Convenience pre-bound for appointment payloads. */
export const redactAppointmentLog = redactPiiFields<unknown>(['notes'])
