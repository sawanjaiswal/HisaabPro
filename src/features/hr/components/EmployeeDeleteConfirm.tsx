/** EmployeeDeleteConfirm — Phase 6 PR6 FE
 *
 * Thin wrapper over `<ConfirmDialog>` that names the employee being deleted
 * so the message is specific ("Delete Raju Mehta?" not "Delete employee?").
 *
 * Soft-delete semantics — calls `useEmployeeMutations().remove` which posts
 * DELETE /hr/employees/:id; the BE marks Employee.isDeleted + Party.isDeleted
 * in one transaction. We don't surface those mechanics to the user; from
 * their POV the employee is removed and historical payroll/attendance rows
 * keep referring to the now-soft-deleted Employee row by id.
 */

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import type { Employee } from '../hr.types'

interface EmployeeDeleteConfirmProps {
  open: boolean
  employee: Employee | null
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}

export function EmployeeDeleteConfirm({
  open,
  employee,
  onClose,
  onConfirm,
  isLoading,
}: EmployeeDeleteConfirmProps) {
  const { t } = useLanguage()

  if (!employee) return null

  const description = (t.employeeDeleteConfirmDescription as string).replace(
    '{name}',
    employee.name,
  )

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.employeeDeleteConfirmTitle as string}
      description={description}
      confirmLabel={t.employeeDeleteConfirmCta as string}
      cancelLabel={t.cancel as string}
      isDanger
      isLoading={isLoading}
    />
  )
}
