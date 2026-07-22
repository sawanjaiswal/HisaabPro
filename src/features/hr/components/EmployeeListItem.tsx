/** EmployeeListItem — one employee row (mockup #21).
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ [Avatar]  Name                                    [Active]  │
 *   │           Designation · +91 98765 43210                     │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Colored initial avatar + status pill, matching the parties/customers list.
 * The parent owns navigation; this stays a dumb, testable row.
 */

import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatPhone } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import type { Employee } from '../hr.types'

interface EmployeeListItemProps {
  employee: Employee
  onClick: () => void
}

export function EmployeeListItem({ employee, onClick }: EmployeeListItemProps) {
  const { t } = useLanguage()
  const active = !employee.leftAt

  const subtitleParts: string[] = []
  if (employee.designation) subtitleParts.push(employee.designation)
  if (employee.phone) subtitleParts.push(formatPhone(employee.phone))
  const subtitle = subtitleParts.join(' · ')

  return (
    <Button
      variant="none"
      type="button"
      onClick={onClick}
      className="employee-row"
      aria-label={employee.name}
    >
      <PartyAvatar name={employee.name} phone={employee.phone} size="sm" />

      <span className="employee-row-body">
        <span className="employee-row-name">{employee.name}</span>
        {subtitle && <span className="employee-row-sub">{subtitle}</span>}
      </span>

      <Badge variant={active ? 'paid' : 'draft'}>
        {active ? (t.active as string) : (t.inactive as string)}
      </Badge>
    </Button>
  )
}
