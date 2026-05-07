/**
 * Notification Engine — Template Service (PR3)
 *
 * Responsibilities:
 *   1. Resolve the correct template for (eventKey, channel, locale).
 *   2. Substitute {{varName}} placeholders — non-recursive, no eval,
 *      regex /\{\{(\w+)\}\}/g only.
 *   3. Format paise → rupee string helper (callers pass pre-formatted strings;
 *      helper exported for use by callers before building vars map).
 *   4. Return a RenderedTemplate ready for the provider.
 *
 * No Prisma. No HTML generation (email provider wraps later). No user input
 * in template strings. Static map delegated to notification-templates.data.ts.
 */

import type { ChannelType, RenderedTemplate } from './notification-types.js'
import type { EventKey } from './notification-events.js'
import { EVENT_META } from './notification-events.js'
import { TEMPLATE_DATA } from './notification-templates.data.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupportedLocale = 'en' | 'hi'

/** All vars must carry pre-formatted strings (paise → Rs done by caller). */
export type TemplateVars = Record<string, string | number>

// ---------------------------------------------------------------------------
// Paise → Rupee formatter (exported for callers to use before building vars)
// ---------------------------------------------------------------------------

/**
 * Formats a paise integer into a human-readable Indian rupee string.
 * Examples:
 *   formatPaise(150000) → "Rs 1,500"
 *   formatPaise(5000)   → "Rs 50"
 *   formatPaise(0)      → "Rs 0"
 *
 * Uses Intl.NumberFormat with en-IN locale for comma grouping.
 */
export function formatPaise(paise: number): string {
  const rupees = Math.floor(paise / 100)
  const paiseRemainder = paise % 100

  if (paiseRemainder === 0) {
    return `Rs ${new Intl.NumberFormat('en-IN').format(rupees)}`
  }
  // Include paise fraction only when non-zero
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
  return `Rs ${formatted}`
}

// ---------------------------------------------------------------------------
// Placeholder substitution
// ---------------------------------------------------------------------------

/** Tracks which missing keys have already been warned for this process lifetime. */
const _warnedKeys = new Set<string>()

/**
 * Substitutes {{varName}} placeholders in `tpl` using values from `vars`.
 *
 * Rules:
 *  - Regex: /\{\{(\w+)\}\}/g — single-level only. No nesting, no recursion.
 *  - Missing var: leaves placeholder as-is; emits console.warn once per key.
 *  - No eval, no new Function().
 */
function substitute(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key])
    }
    if (!_warnedKeys.has(key)) {
      _warnedKeys.add(key)
      console.warn(
        `[notification-template] Missing template variable "{{${key}}}" — leaving as-is.`,
      )
    }
    return `{{${key}}}`
  })
}

// ---------------------------------------------------------------------------
// Template key resolver
// ---------------------------------------------------------------------------

/**
 * Builds the template map key from event metadata and channel.
 * Pattern: `${templateName}.${channel.toLowerCase()}`
 */
function resolveKey(eventKey: EventKey, channel: ChannelType): string {
  const meta = EVENT_META[eventKey]
  return `${meta.templateName}.${channel.toLowerCase()}`
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Renders a notification template for the given event, channel, and locale.
 *
 * @param eventKey  - One of the 18 EventKey values.
 * @param channel   - Target channel (IN_APP, PUSH, EMAIL, SMS).
 * @param locale    - 'en' or 'hi'. Defaults to 'en' when not found.
 * @param vars      - Substitution variables. Paise amounts must be
 *                    pre-formatted by caller using formatPaise().
 * @returns RenderedTemplate ready for a provider.
 *
 * @throws Error when no template entry exists for (eventKey, channel) —
 *   callers should guard using EVENT_META[eventKey].defaultChannels
 *   to avoid requesting unsupported channel combinations.
 */
export function renderTemplate(
  eventKey: EventKey,
  channel: ChannelType,
  locale: SupportedLocale,
  vars: TemplateVars,
): RenderedTemplate {
  const tplKey = resolveKey(eventKey, channel)
  const localeMap = TEMPLATE_DATA[tplKey]

  if (!localeMap) {
    throw new Error(
      `No template registered for key "${tplKey}". ` +
        `Check EVENT_META[${eventKey}].templateName and TEMPLATE_DATA.`,
    )
  }

  // Fall back to 'en' when requested locale has no entry
  const raw = localeMap[locale] ?? localeMap['en']

  const title = substitute(raw.titleTpl, vars)
  const body  = substitute(raw.bodyTpl, vars)
  const deepLinkUrl = raw.deepLinkTpl
    ? substitute(raw.deepLinkTpl, vars)
    : undefined

  // Build channel-specific payload extras
  const fcmData: Record<string, string> | undefined =
    channel === 'PUSH'
      ? {
          eventKey,
          entityType: String(vars['entityType'] ?? ''),
          entityId:   String(vars['entityId'] ?? ''),
          deepLinkUrl: deepLinkUrl ?? '',
        }
      : undefined

  const smsDltTemplateId: string | undefined =
    channel === 'SMS'
      ? (vars['smsDltTemplateId'] as string | undefined)
      : undefined

  return {
    title,
    body,
    deepLinkUrl,
    payload: {
      ...(fcmData !== undefined ? { fcmData } : {}),
      ...(smsDltTemplateId !== undefined ? { smsDltTemplateId } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Utility: list all registered template keys (useful in tests)
// ---------------------------------------------------------------------------

export function listTemplateKeys(): string[] {
  return Object.keys(TEMPLATE_DATA)
}
