/** PayrollPreviewTable — Phase 6 PR6 FE
 *
 * Tabular view of payroll lines. Used in BOTH:
 *   - PayrollWizardPage  (pre-finalize preview — editable nothing, view-only)
 *   - PayrollRunDetailPage (post-finalize view — same shape, frozen rows)
 *
 * Layout strategy:
 *   <md  → stacked cards (one card per employee — readable on 320px)
 *   ≥md  → real <table> with sticky head + tabular-nums for alignment
 *
 * Money is paise on the wire; we format via `formatPaise()` per cell. All
 * column heads are i18n keys; all colors are tokens.
 *
 * Empty state is owned by the PARENT (this component renders nothing when
 * `lines.length === 0`) — the wizard distinguishes "no preview yet" vs
 * "preview returned zero employees".
 */

import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import type { PayrollLine, PayrollPreviewTotals } from '../payroll.types'

interface PayrollPreviewTableProps {
  lines: PayrollLine[]
  totals: PayrollPreviewTotals
}

export function PayrollPreviewTable({ lines, totals }: PayrollPreviewTableProps) {
  const { t } = useLanguage()

  if (lines.length === 0) return null

  return (
    <div>
      {/* Mobile <md — stacked cards */}
      <ul className="md:hidden space-y-3 list-none p-0 m-0">
        {lines.map((line) => (
          <li key={line.employeeId}>
            <article
              className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-3"
              aria-label={line.employeeName}
            >
              <header className="flex items-baseline justify-between gap-2 mb-2">
                <h3 className="text-[var(--fs-base)] font-medium text-[var(--color-text)] truncate">
                  {line.employeeName}
                </h3>
                <span className="text-[var(--fs-base)] font-semibold text-[var(--color-text)] tabular-nums whitespace-nowrap">
                  {formatPaise(line.netPaise)}
                </span>
              </header>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--fs-sm)]">
                <dt className="text-[var(--color-text-secondary)]">{t.payrollColPresent as string}</dt>
                <dd className="tabular-nums text-right text-[var(--color-text)]">{line.presentDays}</dd>

                <dt className="text-[var(--color-text-secondary)]">{t.payrollColHalf as string}</dt>
                <dd className="tabular-nums text-right text-[var(--color-text)]">{line.halfDays}</dd>

                <dt className="text-[var(--color-text-secondary)]">{t.payrollColOvertimeMin as string}</dt>
                <dd className="tabular-nums text-right text-[var(--color-text)]">{line.overtimeMin}</dd>

                <dt className="text-[var(--color-text-secondary)]">{t.payrollColGross as string}</dt>
                <dd className="tabular-nums text-right text-[var(--color-text)]">{formatPaise(line.grossPaise)}</dd>

                <dt className="text-[var(--color-text-secondary)]">{t.payrollColAdvance as string}</dt>
                <dd className="tabular-nums text-right text-[var(--color-text)]">{formatPaise(line.advanceTotalPaise)}</dd>

                <dt className="text-[var(--color-text-secondary)]">{t.payrollColDeductions as string}</dt>
                <dd className="tabular-nums text-right text-[var(--color-text)]">{formatPaise(line.deductionsPaise)}</dd>
              </dl>
            </article>
          </li>
        ))}
      </ul>

      {/* Desktop ≥md — table */}
      <div className="hidden md:block overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full border-collapse text-[var(--fs-sm)]">
          <thead className="bg-[var(--color-surface-muted)]">
            <tr>
              <th scope="col" className="text-left p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColEmployee as string}
              </th>
              <th scope="col" className="text-right p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColPresent as string}
              </th>
              <th scope="col" className="text-right p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColHalf as string}
              </th>
              <th scope="col" className="text-right p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColOvertimeMin as string}
              </th>
              <th scope="col" className="text-right p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColGross as string}
              </th>
              <th scope="col" className="text-right p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColAdvance as string}
              </th>
              <th scope="col" className="text-right p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColDeductions as string}
              </th>
              <th scope="col" className="text-right p-2 text-[var(--color-text-secondary)] font-medium">
                {t.payrollColNet as string}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.employeeId} className="border-t border-[var(--color-border)]">
                <td className="p-2 text-[var(--color-text)]">{line.employeeName}</td>
                <td className="p-2 text-right tabular-nums text-[var(--color-text)]">{line.presentDays}</td>
                <td className="p-2 text-right tabular-nums text-[var(--color-text)]">{line.halfDays}</td>
                <td className="p-2 text-right tabular-nums text-[var(--color-text)]">{line.overtimeMin}</td>
                <td className="p-2 text-right tabular-nums text-[var(--color-text)]">{formatPaise(line.grossPaise)}</td>
                <td className="p-2 text-right tabular-nums text-[var(--color-text)]">{formatPaise(line.advanceTotalPaise)}</td>
                <td className="p-2 text-right tabular-nums text-[var(--color-text)]">{formatPaise(line.deductionsPaise)}</td>
                <td className="p-2 text-right tabular-nums font-semibold text-[var(--color-text)]">{formatPaise(line.netPaise)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[var(--color-surface-muted)]">
            <tr className="border-t border-[var(--color-border)]">
              <th scope="row" className="p-2 text-left text-[var(--color-text)] font-semibold">
                {t.payrollTotalsLabel as string}
              </th>
              <td colSpan={3} />
              <td className="p-2 text-right tabular-nums font-semibold text-[var(--color-text)]">{formatPaise(totals.grossPaise)}</td>
              <td colSpan={2} />
              <td className="p-2 text-right tabular-nums font-semibold text-[var(--color-text)]">{formatPaise(totals.netPaise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile totals — outside the cards (always visible) */}
      <div
        className="md:hidden mt-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] border border-[var(--color-border)] p-3"
        aria-label={t.payrollTotalsLabel as string}
      >
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--fs-sm)]">
          <dt className="text-[var(--color-text-secondary)]">{t.payrollColGross as string}</dt>
          <dd className="tabular-nums text-right font-medium text-[var(--color-text)]">{formatPaise(totals.grossPaise)}</dd>

          <dt className="text-[var(--fs-base)] text-[var(--color-text)] font-semibold">{t.payrollColNet as string}</dt>
          <dd className="tabular-nums text-right text-[var(--fs-base)] font-semibold text-[var(--color-text)]">{formatPaise(totals.netPaise)}</dd>
        </dl>
      </div>
    </div>
  )
}
