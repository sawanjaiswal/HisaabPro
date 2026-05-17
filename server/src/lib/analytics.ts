/**
 * Analytics emitter — Phase 5 Epic D wrapper (v2 / M5).
 *
 * Single entry point for all Epic D telemetry events. Routes through
 * the structured `logger.info(...)` channel — NOT `notificationManager`,
 * which is reserved for end-user notifications.
 *
 * Events MUST be emitted AFTER their originating Prisma transaction has
 * committed (architecture §3.8 side-effect rule). Emitting from inside
 * a `$transaction` couples observability to DB rollback semantics — a
 * later refactor that rolls back the tx would silently swallow events
 * we relied on for analytics.
 *
 * Architecture §10 lists the 9 events used by Epic D. Adding a new event:
 *   1. Append the literal to AnalyticsEvent union below.
 *   2. Document the trigger site + payload shape in architecture §10.
 *   3. Emit from POST-commit code only.
 */

import logger from './logger.js'

export type AnalyticsEvent =
  // Loyalty #125
  | 'loyalty_program_enabled'
  | 'loyalty_accrued'
  | 'loyalty_redeemed'
  | 'loyalty_restored'
  // Commission #128
  | 'commission_rule_created'
  | 'commission_accrued'
  | 'commission_restored'
  // CRM #127
  | 'crm_tag_filtered'
  | 'crm_followup_set'

/**
 * Emit a structured analytics event. Context is an open record — every
 * call site documents its own payload in architecture §10. Drift between
 * documented and actual payloads is caught in the auditor pass.
 */
export function analyticsEmit(
  event: AnalyticsEvent,
  ctx: Record<string, unknown>
): void {
  logger.info(`analytics.${event}`, { event, ...ctx })
}
