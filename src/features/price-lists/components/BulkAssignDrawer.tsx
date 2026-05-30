/** BulkAssignDrawer — select parties and bulk-assign to a price list */

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { useQuery } from '@tanstack/react-query'
import { Search, Users, AlertTriangle } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { getParties } from '@/features/parties/party.service'
import { useBulkAssignParties } from '../price-list-queries'
import './bulk-assign-drawer.css'
import { Input } from '@/components/ui/Input'

interface BulkAssignDrawerProps {
  open: boolean
  onClose: () => void
  priceListId: string
  listName: string
}

export function BulkAssignDrawer({ open, onClose, priceListId, listName }: BulkAssignDrawerProps) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const mutation = useBulkAssignParties(priceListId, listName)

  useEffect(() => { if (!open) { setSearch(''); setSelected(new Set()) } }, [open])

  const query = useQuery({
    queryKey: ['parties', 'bulk-assign-list'],
    queryFn: ({ signal }) => getParties({ limit: 500, isActive: true, sortBy: 'name', sortOrder: 'asc' }, signal),
    enabled: open,
    staleTime: 30_000,
  })

  const allParties = useMemo(() => (query.data?.parties ?? []).slice(0, 100), [query.data])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? allParties.filter((p) => p.name.toLowerCase().includes(q)) : allParties
  }, [allParties, search])

  const reassignCount = useMemo(
    () => filtered.filter((p) => selected.has(p.id) && p.priceListId && p.priceListId !== priceListId).length,
    [filtered, selected, priceListId],
  )

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next
  })

  const handleSelectAll = () => setSelected((prev) => {
    const alreadyAll = filtered.every((p) => prev.has(p.id))
    if (alreadyAll) return new Set([...prev].filter((id) => !filtered.some((p) => p.id === id)))
    const next = new Set(prev); filtered.forEach((p) => next.add(p.id)); return next
  })

  const selectedCount = selected.size
  const isLoading = query.isPending
  const isError = query.isError
  const isEmpty = !isLoading && !isError && filtered.length === 0
  const errorMsg = query.error instanceof ApiError ? query.error.message : t.plBulkAssignLoadError

  const handleAssign = () => {
    if (!selectedCount) return
    mutation.mutate([...selected], { onSuccess: () => onClose() })
  }

  const footer = (
    <div className="bad__footer">
      {reassignCount > 0 && (
        <div className="bad__warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{reassignCount} {t.plBulkAssignWarning}</span>
        </div>
      )}
      <div className="bad__count-strip">
        <span>{selectedCount} {t.plBulkAssignSelected}</span>
        <Button
          type="button"
          variant="primary" size="md" className="bad__cta"
          disabled={selectedCount === 0 || mutation.isPending}
          onClick={handleAssign}
          aria-busy={mutation.isPending}
        >
          {mutation.isPending ? t.saving : `${t.plBulkAssignCta} ${listName}`}
        </Button>
      </div>
    </div>
  )

  return (
    <Drawer open={open} onClose={onClose} title={`${t.plBulkAssignTitle} ${listName}`} size="md" footer={footer}>
      <div className="bad">
        <div className="bad__search-wrap">
          <Search size={16} className="bad__search-icon" aria-hidden="true" />
          <Input
            className="bad__search" type="search"
            placeholder={t.plBulkAssignSearch} value={search}
            onChange={(e) => setSearch(e.target.value)} aria-label={t.plBulkAssignSearch}
          />
        </div>

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="bad__helpers">
            <button type="button" className="bad__helper-btn" onClick={handleSelectAll}>
              {t.plBulkAssignSelectAll} ({filtered.length})
            </button>
            {selectedCount > 0 && (
              <button type="button" className="bad__helper-btn bad__helper-btn--muted" onClick={() => setSelected(new Set())}>
                {t.plBulkAssignClear}
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="bad__state" aria-busy="true" aria-label="Loading parties">
            {[0,1,2,3,4].map((i) => <div key={i} className="bad__skeleton" />)}
          </div>
        )}

        {isError && (
          <div className="bad__state" role="alert">
            <Users size={32} aria-hidden="true" />
            <p>{errorMsg}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => query.refetch()}>{t.retry}</button>
          </div>
        )}

        {isEmpty && (
          <div className="bad__state">
            <Users size={32} aria-hidden="true" />
            <p className="bad__state-title">{t.plBulkAssignNoParties}</p>
            <p className="bad__state-body">{t.plBulkAssignNoPartiesDesc}</p>
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <ul className="bad__list" role="list">
            {filtered.map((party) => {
              const hasOtherList = !!party.priceListId && party.priceListId !== priceListId
              const isCurrent = party.priceListId === priceListId
              return (
                <li key={party.id} className="bad__row">
                  <label className="bad__label">
                    <Input type="checkbox" className="bad__checkbox" checked={selected.has(party.id)}
                      onChange={() => toggle(party.id)} aria-label={party.name} />
                    <span className="bad__party-name">{party.name}</span>
                    {hasOtherList && party.priceList && (
                      <span className="bad__chip bad__chip--other" title={t.plBulkAssignCurrentList}>{party.priceList.name}</span>
                    )}
                    {isCurrent && party.priceList && (
                      <span className="bad__chip bad__chip--current">{party.priceList.name}</span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Drawer>
  )
}
