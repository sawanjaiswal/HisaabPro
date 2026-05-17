/**
 * SECURITY EVENT TAXONOMY — SSOT for security-event names (Q2 closure v2.3).
 *
 * Emit sites import `SECURITY_EVENT` and pass the constant — no string
 * literals at emit sites means we never silently typo a metric name. The
 * `emitSecurityEvent` dispatcher fans out to (a) the structured logger
 * (always) and (b) the metrics backend (if wired). Metrics wiring lives in
 * `observability.service.ts` (Phase 6 PR8 — for now logger-only is fine).
 *
 * Architecture reference: ARCHITECTURE_PHASE6_STAFF_HR §10.5.
 *
 * Alert rule: `pin_gate.cookie_tamper_detected > 5/min sustained for 5min on
 * same IP` → page on-call. Only `hmac_mismatch`, `cross_user`, `cross_tenant`,
 * and `domain_prefix_mismatch` roll up into `cookie_tamper_detected`;
 * `pf_stale` is benign (legitimate PIN rotation) and is logged-only.
 */

import logger from './logger.js'

export const SECURITY_EVENT = {
  /** Aggregate alert — fired by emitSecurityEvent for the four suspicious fail modes. */
  PIN_GATE_COOKIE_TAMPER_DETECTED: 'pin_gate.cookie_tamper_detected',
  /** Benign — PIN was rotated by reset/change, so cookie's pf no longer matches pinHash. */
  PIN_GATE_PF_STALE: 'pin_gate.pf_stale',
  /** Suspicious — cookie's userId differs from session's userId. */
  PIN_GATE_CROSS_USER: 'pin_gate.cross_user',
  /** Suspicious — cookie's businessId differs from session's activeBusinessId. */
  PIN_GATE_CROSS_TENANT: 'pin_gate.cross_tenant',
  /** Suspicious — HMAC signature failed verification (cookie body was modified). */
  PIN_GATE_HMAC_MISMATCH: 'pin_gate.hmac_mismatch',
  /** Suspicious — HMAC was computed without the domain-separation prefix. */
  PIN_GATE_DOMAIN_PREFIX_MISMATCH: 'pin_gate.domain_prefix_mismatch',
} as const

export type SecurityEvent = (typeof SECURITY_EVENT)[keyof typeof SECURITY_EVENT]

/** Suspicious events that roll up into the cookie_tamper_detected aggregate alert. */
const SUSPICIOUS_EVENTS: ReadonlySet<SecurityEvent> = new Set([
  SECURITY_EVENT.PIN_GATE_CROSS_USER,
  SECURITY_EVENT.PIN_GATE_CROSS_TENANT,
  SECURITY_EVENT.PIN_GATE_HMAC_MISMATCH,
  SECURITY_EVENT.PIN_GATE_DOMAIN_PREFIX_MISMATCH,
])

export interface SecurityEventLabels {
  /** Affected user (when known). MUST NOT include PII beyond the userId scalar. */
  userId?: string
  /** Source IP (request-scoped). */
  ip?: string
  /** One-line reason — safe to log (no token bytes, no cookie body, no PII). */
  reason?: string
}

/**
 * Emit a security event to the structured logger; also emits the
 * `cookie_tamper_detected` aggregate event for the four suspicious fail modes
 * so the alert rule (5/min on same IP) can sustain on the aggregate counter.
 *
 * Never throws — telemetry failures must not break the request path.
 */
export function emitSecurityEvent(event: SecurityEvent, labels: SecurityEventLabels = {}): void {
  try {
    logger.warn('security_event', { event, ...labels })
    if (SUSPICIOUS_EVENTS.has(event)) {
      logger.warn('security_event', {
        event: SECURITY_EVENT.PIN_GATE_COOKIE_TAMPER_DETECTED,
        triggeredBy: event,
        ...labels,
      })
    }
  } catch {
    // intentionally swallowed — telemetry must never break the request path
  }
}
