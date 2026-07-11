/** EmployeePicker — searchable list of active employees.
 *
 *  Fetches `/hr/employees?limit=100` via `useEmployees()` (already used by
 *  AttendancePage so we share the cache). Filters client-side on the typed
 *  query. Designed for ≤200 employees per business — beyond that we'd
 *  paginate via server `q=`.
 *
 *  Selecting an employee stores BOTH id + name in the form so the appointment
 *  can carry the snapshot the user saw at submit time.
 */

import { useMemo, useState } from 'react'
import { Search, User as UserIcon, Check } from 'lucide-react'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import { useEmployees } from '@/features/hr/useEmployees'
import type { EmployeeLite } from '@/features/hr/hr.types'

interface EmployeePickerProps {
  employeeId: string | null
  onChange: (id: string | null, name: string | null) => void
}

export function EmployeePicker({ employeeId, onChange }: EmployeePickerProps) {
  const { t } = useLanguage()
  const { employees, status } = useEmployees()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const active = (employees as EmployeeLite[]).filter((e) => e.active)
    if (!q) return active
    return active.filter((e) => e.name.toLowerCase().includes(q))
  }, [employees, query])

  const selected = (employees as EmployeeLite[]).find((e) => e.id === employeeId) ?? null

  return (
    <div>
      <div className="text-[var(--fs-sm)] mb-1.5" style={{ color: 'var(--color-text)' }}>
        {t.pickEmployee ?? 'Pick employee'}
      </div>

      {selected ? (
        <div
          className="flex items-center justify-between gap-2 p-3 rounded-[var(--radius-md)] min-h-[44px]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <UserIcon size={16} aria-hidden="true" />
            <span className="truncate">{selected.name}</span>
          </div>
          <Button
            variant="none"
            type="button"
            className="text-[var(--fs-sm)] min-h-[44px] px-2"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => onChange(null, null)}
            aria-label={t.clear ?? 'Clear'}
          >
            {t.change ?? 'Change'}
          </Button>
        </div>
      ) : (
        <>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchEmployees ?? 'Search employees…'}
            icon={<Search size={16} aria-hidden="true" />}
            aria-label={t.searchEmployees ?? 'Search employees'}
          />

          <div
            className="mt-2 rounded-[var(--radius-md)] overflow-hidden"
            style={{ border: '1px solid var(--color-border)', maxHeight: '240px', overflowY: 'auto' }}
          >
            {status === 'loading' && (
              <div className="p-3 space-y-2" aria-live="polite" aria-busy="true">
                <Skeleton height="32px" />
                <Skeleton height="32px" />
              </div>
            )}
            {status === 'error' && (
              <div className="p-3 text-[var(--fs-sm)]" style={{ color: 'var(--color-error)' }}>
                {t.employeeLoadFailed ?? 'Could not load employees'}
              </div>
            )}
            {status === 'success' && filtered.length === 0 && (
              <div className="p-3 text-[var(--fs-sm)]" style={{ color: 'var(--color-text-muted)' }}>
                {t.noEmployeesMatch ?? 'No matches'}
              </div>
            )}
            {status === 'success' && filtered.length > 0 && (
              <ul role="listbox" aria-label={t.pickEmployee ?? 'Pick employee'}>
                {filtered.map((e) => (
                  <li key={e.id}>
                    <Button
                      variant="none"
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => { onChange(e.id, e.name); setQuery('') }}
                      className="w-full text-left flex items-center justify-between gap-2 px-3 min-h-[44px] text-[var(--fs-sm)]"
                      style={{ background: 'transparent' }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <UserIcon size={14} aria-hidden="true" />
                        <span className="truncate">{e.name}</span>
                      </span>
                      <Check size={14} aria-hidden="true" style={{ opacity: 0 }} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
