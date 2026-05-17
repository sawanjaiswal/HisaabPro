/**
 * Commission #128 — Zod input validation.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §4 + §6.4.
 * Security audit S2 (rateBps.max(10000)), M3 (withinDays cap), M4 (staff 404).
 *
 * All schemas use `.strict()`. Mode/scope cross-field constraints are enforced
 * via `.superRefine()` so callers get a 400 with the exact failure reason
 * rather than a discriminated-union mismatch in the error.
 */

import { z } from 'zod'
import {
  COMMISSION_APPLIES_TO_VALUES,
  COMMISSION_FLAT_MAX_PAISE,
  COMMISSION_NAME_MAX_LEN,
  COMMISSION_NAME_MIN_LEN,
  COMMISSION_PAGE_SIZE_DEFAULT,
  COMMISSION_PAGE_SIZE_MAX,
  COMMISSION_RATE_MAX_BPS,
  COMMISSION_RULE_MODES,
  COMMISSION_RULE_SCOPES,
  COMMISSION_SCOPE_ID_MAX_LEN,
  FLAT_MODES,
  PERCENT_MODES,
  PERIOD_YEAR_MONTH_REGEX,
} from '../services/commission/commission.constants.js'

// ─── Rule create / update (POST /commission/rules, PUT /commission/rules/:id) ─

// Inner shape — exported so the PUT route can derive a `.partial().strict()`
// from it (Zod cannot call `.partial()` on a `.superRefine()`-wrapped schema).
export const commissionRuleInputObjectShape = {
  name: z
    .string()
    .min(COMMISSION_NAME_MIN_LEN, 'name is required')
    .max(COMMISSION_NAME_MAX_LEN, `name must be <= ${COMMISSION_NAME_MAX_LEN} characters`),
  scope: z.enum(COMMISSION_RULE_SCOPES),
  scopeId: z
    .string()
    .min(1)
    .max(COMMISSION_SCOPE_ID_MAX_LEN)
    .nullable()
    .optional(),
  mode: z.enum(COMMISSION_RULE_MODES),
  rateBps: z
    .number()
    .int()
    .min(0, 'rateBps must be >= 0')
    .max(COMMISSION_RATE_MAX_BPS, 'COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT')
    .nullable()
    .optional(),
  flatPerUnitPaise: z
    .number()
    .int()
    .min(0, 'flatPerUnitPaise must be >= 0')
    .max(COMMISSION_FLAT_MAX_PAISE, 'flatPerUnitPaise exceeds cap')
    .nullable()
    .optional(),
  appliesTo: z.enum(COMMISSION_APPLIES_TO_VALUES),
  staffUserIds: z.array(z.string().min(1)).default([]),
  isActive: z.boolean().default(true),
} as const

const commissionRuleInputBase = z.object(commissionRuleInputObjectShape).strict()

function applyCrossFieldRefine<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: z.infer<typeof commissionRuleInputBase>, ctx) => {
    // Scope vs scopeId
    if (data.scope === 'ALL' && data.scopeId !== undefined && data.scopeId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scopeId must be null/undefined when scope=ALL',
        path: ['scopeId'],
      })
    }
    if ((data.scope === 'PRODUCT' || data.scope === 'CATEGORY') && !data.scopeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `scopeId is required when scope=${data.scope}`,
        path: ['scopeId'],
      })
    }
    // Mode vs rateBps / flatPerUnitPaise (XOR)
    if (PERCENT_MODES.has(data.mode)) {
      if (data.rateBps === undefined || data.rateBps === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rateBps is required when mode=${data.mode}`,
          path: ['rateBps'],
        })
      }
      if (data.flatPerUnitPaise !== undefined && data.flatPerUnitPaise !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `flatPerUnitPaise must be null when mode=${data.mode}`,
          path: ['flatPerUnitPaise'],
        })
      }
    }
    if (FLAT_MODES.has(data.mode)) {
      if (data.flatPerUnitPaise === undefined || data.flatPerUnitPaise === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'flatPerUnitPaise is required when mode=FLAT_PER_UNIT',
          path: ['flatPerUnitPaise'],
        })
      }
      if (data.rateBps !== undefined && data.rateBps !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rateBps must be null when mode=FLAT_PER_UNIT',
          path: ['rateBps'],
        })
      }
    }
    // Note: appliesTo is POS/INVOICE/BOTH (document type). Staff targeting is
    // orthogonal — staffUserIds[] empty = all staff, non-empty = only those
    // staff. No correlation rule needed here (architecture §2.3).
  })
}

export const commissionRuleInputSchema = applyCrossFieldRefine(commissionRuleInputBase)

/**
 * PUT /commission/rules/:id — every field optional. Cross-field XOR rule
 * still fires for callers who pass `mode` (paired with rate/flat). When `mode`
 * is omitted, we cannot enforce the XOR (we'd reject every partial), so the
 * refine is a no-op in that case.
 */
export const commissionRuleUpdateSchema = z
  .object(commissionRuleInputObjectShape)
  .strict()
  .partial()
  .superRefine((data, ctx) => {
    if (data.scope === 'ALL' && data.scopeId !== undefined && data.scopeId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scopeId must be null/undefined when scope=ALL',
        path: ['scopeId'],
      })
    }
    if (
      (data.scope === 'PRODUCT' || data.scope === 'CATEGORY') &&
      data.scopeId === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `scopeId is required when scope=${data.scope}`,
        path: ['scopeId'],
      })
    }
    // Mode-bound XOR — only enforced when `mode` is being patched.
    if (data.mode && PERCENT_MODES.has(data.mode)) {
      if (data.flatPerUnitPaise !== undefined && data.flatPerUnitPaise !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `flatPerUnitPaise must be null when mode=${data.mode}`,
          path: ['flatPerUnitPaise'],
        })
      }
    }
    if (data.mode && FLAT_MODES.has(data.mode)) {
      if (data.rateBps !== undefined && data.rateBps !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rateBps must be null when mode=FLAT_PER_UNIT',
          path: ['rateBps'],
        })
      }
    }
  })

// ─── Ledger query (GET /commission/ledger) ─────────────────────────────────

/**
 * `staffUserId` optional — when absent, route uses the caller's id (staff
 * RBAC). When present, route checks `commission.view_all` permission.
 */
export const commissionLedgerQuerySchema = z.object({
  staffUserId: z.string().min(1).optional(),
  periodYearMonth: z
    .string()
    .regex(PERIOD_YEAR_MONTH_REGEX, 'periodYearMonth must be YYYY-MM'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(COMMISSION_PAGE_SIZE_MAX)
    .default(COMMISSION_PAGE_SIZE_DEFAULT),
}).strict()

// ─── Leaderboard query (GET /commission/leaderboard) ──────────────────────

export const commissionLeaderboardQuerySchema = z.object({
  periodYearMonth: z
    .string()
    .regex(PERIOD_YEAR_MONTH_REGEX, 'periodYearMonth must be YYYY-MM'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(COMMISSION_PAGE_SIZE_MAX)
    .default(COMMISSION_PAGE_SIZE_DEFAULT),
}).strict()
