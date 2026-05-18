/** EmployeeListPage — Phase 6 PR6 FE
 *
 * /hr/employees — list of employees with create-via-Drawer, search filter,
 * row-tap to detail page.
 *
 * 4 UI states (mandatory):
 *   loading — list skeleton
 *   error   — ErrorState onRetry
 *   empty   — EmptyState with "Add your first employee" CTA
 *   success — list + sticky FAB-style "Add employee" bar (via Drawer trigger)
 *
 * The Drawer-based create flow keeps the user on the list page; on success
 * we close the drawer and the list refreshes (TanStack Query invalidation).
 */

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, UserPlus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { EmployeeListItem } from './components/EmployeeListItem'
import { EmployeeForm, type EmployeeFormHandle } from './components/EmployeeForm'
import { useEmployees, useEmployeeMutations } from './useEmployees'

export default function EmployeeListPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const employeesQuery = useEmployees()
  const mutations = useEmployeeMutations()

  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const formRef = useRef<EmployeeFormHandle>(null)

  const rows = employeesQuery.rows

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return rows
    return rows.filter((e) =>
      e.name.toLowerCase().includes(q)
      || (e.designation ?? '').toLowerCase().includes(q)
      || (e.phone ?? '').includes(q),
    )
  }, [rows, query])

  const isLoading = employeesQuery.status === 'loading'
  const isError = employeesQuery.status === 'error'
  const isEmpty = employeesQuery.status === 'success' && rows.length === 0
  const isEmptyFiltered = employeesQuery.status === 'success' && rows.length > 0 && filtered.length === 0

  function handleSubmitCreate() {
    const input = formRef.current?.submit()
    if (!input) return
    mutations.create.mutate(input, {
      onSuccess: () => {
        setDrawerOpen(false)
      },
    })
  }

  function navigateToDetail(id: string) {
    navigate(ROUTES.HR_EMPLOYEE_DETAIL.replace(':id', id))
  }

  return (
    <AppShell>
      <Header
        title={t.employeesTitle as string}
        backTo={ROUTES.HR_ATTENDANCE}
      />

      <PageContainer variant="list" className="space-y-4">
        {/* Search */}
        {!isLoading && !isError && rows.length > 0 && (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.employeesSearchPlaceholder as string}
            icon={<Search size={16} aria-hidden="true" />}
            aria-label={t.employeesSearchPlaceholder as string}
          />
        )}

        <div style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 5rem)' }}>
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
            <ul className="space-y-2 list-none p-0 m-0">
              {filtered.map((emp) => (
                <li key={emp.id}>
                  <EmployeeListItem
                    employee={emp}
                    onClick={() => navigateToDetail(emp.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageContainer>

      {/* Sticky add bar — sits ABOVE the BottomNav per PLATFORM_SHELL C9. */}
      {!isLoading && !isError && rows.length > 0 && (
        <div
          role="region"
          aria-label={t.employeesAddCta as string}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'var(--bottom-nav-height)',
            zIndex: 2,
            display: 'flex',
            justifyContent: 'center',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => setDrawerOpen(true)}
            className="w-full max-w-sm"
          >
            <Plus size={18} aria-hidden="true" className="inline-block mr-1" />
            {t.employeesAddCta as string}
          </Button>
        </div>
      )}

      {/* Create drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!mutations.create.isPending) setDrawerOpen(false) }}
        title={t.employeesAddCta as string}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setDrawerOpen(false)}
              disabled={mutations.create.isPending}
            >
              {t.cancel as string}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmitCreate}
              loading={mutations.create.isPending}
            >
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
