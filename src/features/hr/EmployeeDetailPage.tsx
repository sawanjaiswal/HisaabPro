/** EmployeeDetailPage — Phase 6 PR6 FE
 *
 * /hr/employees/:id — read-only profile card + edit drawer + delete confirm.
 *
 * 4 UI states:
 *   loading — card skeleton
 *   error   — ErrorState (with notFound 404 surfacing as "Employee not found")
 *   empty   — N/A (single-record page; 404 is "not found", not empty)
 *   success — profile card + sticky action bar (Edit · Delete)
 */

import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, User, Phone, IndianRupee, Briefcase, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise, formatPhone, formatDate } from '@/lib/format'
import { EmployeeForm, type EmployeeFormHandle } from './components/EmployeeForm'
import { EmployeeDeleteConfirm } from './components/EmployeeDeleteConfirm'
import { useEmployee, useEmployeeMutations } from './useEmployees'

interface ProfileRowProps {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}

function ProfileRow({ icon, label, value }: ProfileRowProps) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2">
      <span aria-hidden="true" className="text-[var(--color-text-tertiary)] mt-0.5">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[var(--fs-xs)] text-[var(--color-text-secondary)]">{label}</span>
        <span className="block text-[var(--fs-base)] text-[var(--color-text)] break-words">{value}</span>
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

  function handleUpdate() {
    const patch = formRef.current?.submit()
    if (!patch || !employee) return
    mutations.update.mutate(
      { id: employee.id, patch, name: patch.name },
      {
        onSuccess: () => setEditOpen(false),
      },
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
      />

      <PageContainer variant="detail" className="space-y-4">
        <div style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 5rem)' }}>
          {employeeQuery.status === 'loading' && (
            <div aria-busy="true" aria-label={t.loading as string} className="space-y-3">
              <Skeleton height="48px" />
              <Skeleton height="48px" />
              <Skeleton height="48px" />
              <Skeleton height="48px" />
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

          {employeeQuery.status === 'success' && employee && (
            <article
              className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4"
              aria-label={employee.name}
            >
              <ProfileRow icon={<User size={18} />} label={t.employeeFormLabelName as string} value={employee.name} />
              <ProfileRow icon={<Briefcase size={18} />} label={t.employeeFormLabelDesignation as string} value={employee.designation} />
              <ProfileRow icon={<Phone size={18} />} label={t.employeeFormLabelPhone as string} value={employee.phone ? formatPhone(employee.phone) : null} />
              <ProfileRow icon={<IndianRupee size={18} />} label={t.employeeFormLabelDailyRate as string} value={formatPaise(employee.dailyRate)} />
              <ProfileRow
                icon={<Calendar size={18} />}
                label={t.employeeJoinedAtLabel as string}
                value={employee.joinedAt ? formatDate(employee.joinedAt) : null}
              />
              <ProfileRow
                icon={<Calendar size={18} />}
                label={t.employeeLeftAtLabel as string}
                value={employee.leftAt ? formatDate(employee.leftAt) : null}
              />
            </article>
          )}
        </div>
      </PageContainer>

      {/* Sticky action bar — Edit + Delete. Above BottomNav per C9. */}
      {employeeQuery.status === 'success' && employee && (
        <div
          role="region"
          aria-label={t.employeeDetailActionsLabel as string}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'var(--bottom-nav-height)',
            zIndex: 2,
            display: 'flex',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Button
            variant="destructive"
            size="md"
            onClick={() => setDeleteOpen(true)}
            disabled={mutations.remove.isPending}
            className="flex-1"
          >
            <Trash2 size={18} aria-hidden="true" className="inline-block mr-1" />
            {t.employeeDeleteConfirmCta as string}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setEditOpen(true)}
            className="flex-1"
          >
            <Edit size={18} aria-hidden="true" className="inline-block mr-1" />
            {t.edit as string}
          </Button>
        </div>
      )}

      {/* Edit drawer */}
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
