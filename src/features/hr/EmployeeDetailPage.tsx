/** EmployeeDetailPage — /hr/employees/:id (mockup #27, archetype B).
 *
 * Emerald Hero shell → identity card (avatar · name · role · phone · status
 * pill) → a grouped labelled detail card → BottomActionBar (Delete). Editing
 * happens in a Drawer opened from the header pencil; the mockup's tabs and KYC
 * fields are out of a reskin's scope (no backing data) — see the design plan.
 *
 * 4 UI states:
 *   loading — row skeletons
 *   error   — ErrorState (notFound surfaces as "Employee not found")
 *   empty   — N/A (single record; a missing record is not-found, not empty)
 *   success — identity card + detail rows + action bar
 */

import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise, formatPhone, formatDate } from '@/lib/format'
import { EmployeeForm, type EmployeeFormHandle } from './components/EmployeeForm'
import { EmployeeDeleteConfirm } from './components/EmployeeDeleteConfirm'
import { useEmployee, useEmployeeMutations } from './useEmployees'
import './hr.css'

interface DetailRowProps {
  label: string
  value: string | null | undefined
  numeric?: boolean
}

function DetailRow({ label, value, numeric }: DetailRowProps) {
  if (!value) return null
  return (
    <div className="employee-detail-row">
      <span className="employee-detail-row-label">{label}</span>
      <span className={`employee-detail-row-value${numeric ? ' employee-detail-row-value--num' : ''}`}>
        {value}
      </span>
    </div>
  )
}

export default function EmployeeDetailPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const id = params.id

  const employeeQuery = useEmployee(id)
  const mutations = useEmployeeMutations()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const formRef = useRef<EmployeeFormHandle>(null)

  const employee = employeeQuery.employee
  const isSuccess = employeeQuery.status === 'success' && Boolean(employee)
  const active = employee ? !employee.leftAt : false

  function handleUpdate() {
    const patch = formRef.current?.submit()
    if (!patch || !employee) return
    mutations.update.mutate(
      { id: employee.id, patch, name: patch.name },
      { onSuccess: () => setEditOpen(false) },
    )
  }

  function handleDelete() {
    if (!employee) return
    mutations.remove.mutate(
      { id: employee.id, name: employee.name },
      {
        onSuccess: () => {
          setDeleteOpen(false)
          navigate(ROUTES.HR_EMPLOYEES)
        },
      },
    )
  }

  return (
    <AppShell>
      <Header
        title={employee?.name ?? (t.employeeDetailTitle as string)}
        backTo={ROUTES.HR_EMPLOYEES}
        actions={
          isSuccess ? (
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} aria-label={t.edit as string}>
              <Edit size={18} aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      <HeroPage className="space-y-4">
        {employeeQuery.status === 'loading' && (
          <div aria-busy="true" aria-label={t.loading as string} className="space-y-3">
            <Skeleton height="88px" />
            <Skeleton height="180px" />
          </div>
        )}

        {employeeQuery.status === 'error' && employeeQuery.notFound && (
          <ErrorState
            icon={<ArrowLeft size={22} aria-hidden="true" />}
            title={t.employeeNotFoundTitle as string}
            message={t.employeeNotFoundDescription as string}
            onRetry={() => navigate(ROUTES.HR_EMPLOYEES)}
            retryLabel={t.employeesBackToList as string}
          />
        )}

        {employeeQuery.status === 'error' && !employeeQuery.notFound && (
          <ErrorState
            title={t.employeeLoadError as string}
            onRetry={employeeQuery.refresh}
            retryLabel={t.retry as string}
          />
        )}

        {isSuccess && employee && (
          <>
            <section className="employee-detail-identity" aria-label={employee.name}>
              <PartyAvatar name={employee.name} phone={employee.phone} size="lg" />
              <span className="employee-detail-identity-body">
                <span className="employee-detail-name">{employee.name}</span>
                {employee.designation && (
                  <span className="employee-detail-sub">{employee.designation}</span>
                )}
                {employee.phone && (
                  <span className="employee-detail-sub">{formatPhone(employee.phone)}</span>
                )}
              </span>
              <Badge variant={active ? 'paid' : 'draft'}>
                {active ? (t.active as string) : (t.inactive as string)}
              </Badge>
            </section>

            <section className="employee-detail-group" aria-label={t.employeeDetailsSectionTitle as string}>
              <p className="employee-detail-group-title">{t.employeeDetailsSectionTitle as string}</p>
              <DetailRow label={t.employeeFormLabelDailyRate as string} value={formatPaise(employee.dailyRate)} numeric />
              <DetailRow
                label={t.employeeJoinedAtLabel as string}
                value={employee.joinedAt ? formatDate(employee.joinedAt) : null}
              />
              <DetailRow
                label={t.employeeLeftAtLabel as string}
                value={employee.leftAt ? formatDate(employee.leftAt) : null}
              />
            </section>
          </>
        )}
      </HeroPage>

      {isSuccess && employee && (
        <BottomActionBar role="region" aria-label={t.employeeDetailActionsLabel as string}>
          <Button
            variant="destructive"
            size="md"
            onClick={() => setDeleteOpen(true)}
            disabled={mutations.remove.isPending}
            className="w-full"
          >
            <Trash2 size={18} aria-hidden="true" className="inline-block mr-1" />
            {t.employeeDeleteConfirmCta as string}
          </Button>
        </BottomActionBar>
      )}

      {employee && (
        <Drawer
          open={editOpen}
          onClose={() => { if (!mutations.update.isPending) setEditOpen(false) }}
          title={t.employeeEditTitle as string}
          size="md"
          footer={
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setEditOpen(false)}
                disabled={mutations.update.isPending}
              >
                {t.cancel as string}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleUpdate}
                loading={mutations.update.isPending}
              >
                {t.save as string}
              </Button>
            </div>
          }
        >
          <EmployeeForm ref={formRef} defaults={employee} disabled={mutations.update.isPending} />
        </Drawer>
      )}

      <EmployeeDeleteConfirm
        open={deleteOpen}
        employee={employee}
        onClose={() => { if (!mutations.remove.isPending) setDeleteOpen(false) }}
        onConfirm={handleDelete}
        isLoading={mutations.remove.isPending}
      />
    </AppShell>
  )
}
