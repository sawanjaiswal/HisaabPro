/** EmployeeListItem — Phase 6 PR6 FE
 *
 * Renders ONE employee row in the list. Tappable card (whole surface), with:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ [Avatar]  Name                          Rs 1,500/day  [>]   │
 *   │           Designation · +91 98765 43210                     │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Tokens only — no hex, no Tailwind palette. 44px+ tap target.
 *
 * The parent (`EmployeeListPage`) owns navigation; we surface a `onClick`
 * to keep this component dumb (and trivially testable).
 */

import { ChevronRight, User } from 'lucide-react'
import { formatPaise, formatPhone } from '@/lib/format'
import type { Employee } from '../hr.types'
import { Button } from '@/components/ui/Button'

interface EmployeeListItemProps {
  employee: Employee
  onClick: () => void
}

export function EmployeeListItem({ employee, onClick }: EmployeeListItemProps) {
  const subtitleParts: string[] = []
  if (employee.designation) subtitleParts.push(employee.designation)
  if (employee.phone) subtitleParts.push(formatPhone(employee.phone))
  const subtitle = subtitleParts.join(' · ')

  return (
    <Button variant="none"
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 min-h-[64px] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
      aria-label={employee.name}
    >
      {/* Avatar */}
      <span
        aria-hidden="true"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-600)] flex-shrink-0"
      >
        <User size={18} strokeWidth={2} />
      </span>

      {/* Body */}
      <span className="flex-1 min-w-0">
        <span
          className="block text-[var(--fs-base)] font-medium text-[var(--color-text)] truncate"
        >
          {employee.name}
        </span>
        {subtitle && (
          <span
            className="block text-[var(--fs-sm)] text-[var(--color-text-secondary)] truncate"
          >
            {subtitle}
          </span>
        )}
      </span>

      {/* Right column: daily rate + chevron */}
      <span className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-[var(--fs-sm)] text-[var(--color-text-secondary)] tabular-nums"
        >
          {formatPaise(employee.dailyRate)}
        </span>
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="text-[var(--color-text-tertiary)]"
        />
      </span>
    </Button>
  )
}
