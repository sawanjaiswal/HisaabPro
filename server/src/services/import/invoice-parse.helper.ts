/**
 * Phase 7 · 7.1C — Invoice parse helper.
 *
 * Bridges the invoice parser → aggregator → normalizer pipeline into the
 * shape `parse.service.ts` expects (`StagedInvoiceRowOut[]`). Mirrors
 * `party-parse.helper.ts` + `product-parse.helper.ts` so the orchestrator
 * stays format-agnostic and entity-agnostic.
 *
 * Pipeline:
 *   1. `parseInvoiceFile(buffer, ctx)` — format-specific parser
 *      (tally-voucher / vyapar-csv / busy-xlsx / generic-csv).
 *   2. `aggregateInvoiceRows({ preAggregatedGroups | rows })` —
 *      groups flat lines by `(lower(invoiceNumber), isoDate)`. Tally
 *      short-circuits because vouchers are already grouped.
 *   3. `normalizeInvoiceGroup(g)` — sanitisation, paise narrow, tax
 *      reconciliation. One `StagedInvoiceRow` per aggregated invoice.
 *   4. Map to the structural shape `parse.service.ts` consumes
 *      (`sourceIndex / status / raw / normalized / issues`).
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1C.md §2.1, §2.2, §2.4, §2.5
 *   - SCOPE_PHASE7_IMPORT_7_1C_INVOICES.md L39, L351-355
 */

// PII: this helper never logs raw cell content — sourceIndex + code only (S9).
import { parseInvoiceFile } from './invoice/parsers/index.js'
import { aggregateInvoiceRows } from './invoice/aggregator.js'
import { normalizeInvoiceGroup } from './invoice/normalizer.js'
import type { ImportFormat } from '../../types/import.types.js'

/**
 * Output shape consumed by `parse.service.ts` — matches the structural
 * union the orchestrator uses for parties/products (`status / raw /
 * normalized / issues`). Keeps the orchestrator entity-agnostic.
 */
export interface StagedInvoiceRowOut {
  sourceIndex: number
  status: 'STAGED' | 'ERROR' | 'SKIPPED'
  raw: Record<string, string>
  normalized: { issues?: unknown } & Record<string, unknown>
}

export interface BuildStagedInvoiceRowsArgs {
  buffer: Buffer
  format: ImportFormat
  fileName?: string | undefined
  /** Tenant business id — invoice parsers don't preload FKs (deferred
   * to commit chunk per §6) so we only pass for telemetry / future use. */
  businessId: string
}

/**
 * Parse → aggregate → normalize → flatten to staged-row shape.
 *
 * Status derivation:
 *   - any ERROR issue in `staged.issues` → 'ERROR'
 *   - `staged.normalized === null` (aggregator-level fatal) → 'ERROR'
 *   - otherwise → 'STAGED'
 *
 * SKIPPED is reserved for dedup (added at commit time for invoices —
 * see invoice-exact-dedup.ts). Parse never emits SKIPPED for invoices.
 */
export async function buildStagedInvoiceRows(
  args: BuildStagedInvoiceRowsArgs,
): Promise<StagedInvoiceRowOut[]> {
  const { buffer, format, fileName } = args

  const parseResult = await parseInvoiceFile(buffer, {
    format,
    ...(fileName ? { fileName } : {}),
  })

  // Aggregator branches on parser output kind: Tally is pre-aggregated;
  // CSV/XLSX emit flat row lists.
  const groups = aggregateInvoiceRows(
    parseResult.preAggregated
      ? { preAggregatedGroups: parseResult.groups }
      : { rows: parseResult.rows },
  )

  // Normalise each group into a StagedInvoiceRow, then flatten to the
  // structural shape parse.service expects.
  return groups.map((g) => {
    const staged = normalizeInvoiceGroup(g)
    const hasErrorIssue = staged.issues.some((i) => i.severity === 'ERROR')
    const status: 'STAGED' | 'ERROR' =
      hasErrorIssue || staged.normalized === null ? 'ERROR' : 'STAGED'

    // `raw` is what we want to surface in the preview UI's "source"
    // column. Header fields make the most sense at invoice granularity —
    // line-level rawness lives inside `normalized.lines[].source`.
    const raw: Record<string, string> = {
      invoiceNumber: staged.header.documentNumber ?? '',
      invoiceDate: staged.header.documentDate ?? '',
      partyName: staged.header.partyNameRaw ?? '',
      partyPhone: staged.header.partyPhoneRaw ?? '',
      grandTotal: staged.header.grandTotalRaw ?? '',
      lineCount: String(staged.lines.length),
    }

    const normalized: { issues?: unknown } & Record<string, unknown> = {
      // Surfaced for preview rendering — InvoiceRowCard reads these.
      header: staged.header,
      lines: staged.lines,
      // `normalized` is null when aggregator-level fatal — preserve for
      // the FE so InvoiceRowCard can render a degraded card.
      invoice: staged.normalized,
      issues: staged.issues,
    }

    return {
      sourceIndex: staged.sourceIndex,
      status,
      raw,
      normalized,
    }
  })
}
