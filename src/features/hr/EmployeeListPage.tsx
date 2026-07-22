/** EmployeeListPage — /hr/employees (mockup #21).
 *
 * Archetype A: search → All/Active/Inactive chips → avatar rows → FAB. Create
 * happens in a Drawer so the user never leaves the list; on success the drawer
 * closes and TanStack Query refetches.
 *
 * 4 UI states: skeleton · ErrorState+retry · EmptyState+CTA (and a distinct
 * no-match empty) · list.
 */

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, UserPlus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { EmployeeListItem } from './components/EmployeeListItem'
import { EmployeeForm, type EmployeeFormHandle } from './components/EmployeeForm'
import { useEmployees, useEmployeeMutations } from './useEmployees'
import './hr.css'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

export default function EmployeeListPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const employeesQuery = useEmployees()
  const mutations = useEmployeeMutations()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const formRef = useRef<EmployeeFormHandle>(null)

  const rows = employeesQuery.rows

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((e) => {
      const active = !e.leftAt
      if (status === 'ACTIVE' && !active) return false
      if (status === 'INACTIVE' && active) return false
      if (q.length === 0) return true
      return (
        e.name.toLowerCase().includes(q)
        || (e.designation ?? '').toLowerCase().includes(q)
        || (e.phone ?? '').includes(q)
      )
    })
  }, [rows, query, status])

  const chips: FilterChipOption<StatusFilter>[] = [
    { value: 'ALL', label: t.all as string, count: rows.length },
    { value: 'ACTIVE', label: t.active as string, count: rows.filter((e) => !e.leftAt).length },
    { value: 'INACTIVE', label: t.inactive as string, count: rows.filter((e) => e.leftAt).length },
  ]

  const isLoading = employeesQuery.status === 'loading'
  const isError = employeesQuery.status === 'error'
  const isEmpty = employeesQuery.status === 'success' && rows.length === 0
  const isEmptyFiltered =
    employeesQuery.status === 'success' && rows.length > 0 && filtered.length === 0

  function handleSubmitCreate() {
    const input = formRef.current?.submit()
    if (!input) return
    mutations.create.mutate(input, { onSuccess: () => setDrawerOpen(false) })
  }

  function navigateToDetail(id: string) {
    navigate(ROUTES.HR_EMPLOYEE_DETAIL.replace(':id', id))
  }

  return (
    <AppShell>
      <Header
        title={t.employeesTitle as string}
        backTo={ROUTES.HR_ATTENDANCE}
        actions={
          !isEmpty && !isLoading && !isError ? (
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)} aria-label={t.employeesAddCta as string}>
              <UserPlus size={18} aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      <HeroPage className="employee-list-page space-y-4">
        {!isLoading && !isError && rows.length > 0 && (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.employeesSearchPlaceholder as string}
              icon={<Search size={16} aria-hidden="true" />}
              aria-label={t.employeesSearchPlaceholder as string}
            />
            <FilterChips
              options={chips}
              value={status}
              onChange={setStatus}
              label={t.employeesTitle as string}
            />
          </>
        )}

        {isLoading && (
          <div aria-busy="true" aria-label={t.loading as string} className="space-y-2">
            {[1, 2, 3, 4, 5].map((n) => <Skeleton key={n} height="64px" />)}
          </div>
        )}

        {isError && (
          <ErrorState
            title={t.employeesLoadError as string}
            onRetry={employeesQuery.refresh}
            retryLabel={t.retry as string}
          />
        )}

        {!isLoading && !isError && isEmpty && (
          <EmptyState
            icon={<UserPlus size={28} aria-hidden="true" />}
            title={t.employeesEmptyTitle as string}
            description={t.employeesEmptyDescription as string}
            action={
              <Button variant="primary" size="md" onClick={() => setDrawerOpen(true)}>
                {t.employeesAddCta as string}
              </Button>
            }
          />
        )}

        {!isLoading && !isError && isEmptyFiltered && (
          <EmptyState
            title={t.employeesEmptyFilteredTitle as string}
            description={t.employeesEmptyFilteredDescription as string}
          />
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <ul className="employee-list-grid space-y-2 md:space-y-0 list-none p-0 m-0">
            {filtered.map((emp) => (
              <li key={emp.id}>
                <EmployeeListItem employee={emp} onClick={() => navigateToDetail(emp.id)} />
              </li>
            ))}
          </ul>
        )}
      </HeroPage>

      {!isLoading && !isError && rows.length > 0 && (
        <Button variant="none" className="fab" onClick={() => setDrawerOpen(true)} aria-label={t.employeesAddCta as string}>
          <Plus size={24} aria-hidden="true" />
        </Button>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => { if (!mutations.create.isPending) setDrawerOpen(false) }}
        title={t.employeesAddCta as string}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="md" onClick={() => setDrawerOpen(false)} disabled={mutations.create.isPending}>
              {t.cancel as string}
            </Button>
            <Button variant="primary" size="md" onClick={handleSubmitCreate} loading={mutations.create.isPending}>
              {t.save as string}
            </Button>
          </div>
        }
      >
        <EmployeeForm ref={formRef} disabled={mutations.create.isPending} />
      </Drawer>
    </AppShell>
  )
}
