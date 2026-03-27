/** Units — Management page (lazy loaded)
 *
 * Lists all units (predefined + custom) with search.
 * Tabs: Units · Conversions.
 * Add/edit via bottom sheet (Drawer).
 */

import { useState, useCallback } from 'react'
import { Plus, Ruler } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { useUnitManager } from './useUnitManager'
import { AddUnitSheet } from './components/AddUnitSheet'
import { UnitListItem } from './components/UnitListItem'
import { ConversionListItem } from './components/ConversionListItem'
import { UNITS_PAGE_TABS } from './unit.constants'
import { UNIT_CATEGORY_LABELS } from './unit.constants'
import { groupUnitsByCategory } from './unit.utils'
import type { Unit } from './unit.types'
import './units.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function UnitsPage() {
  const { t } = useLanguage()
  const {
    units,
    conversions,
    status,
    activeTab,
    setActiveTab,
    handleCreate,
    handleUpdate,
    handleDelete,
    refresh,
  } = useUnitManager()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editUnit, setEditUnit] = useState<Unit | null>(null)
  const [searchInput, setSearchInput] = useState('')

  const debouncedSearch = useDebounce(searchInput, 300)

  // Fire search when debounced value changes
  const filteredUnits = debouncedSearch
    ? units.filter(
        (u) =>
          u.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          u.symbol.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : units

  const handleEdit = useCallback((unit: Unit) => {
    setEditUnit(unit)
    setSheetOpen(true)
  }, [])

  const handleAdd = useCallback(() => {
    setEditUnit(null)
    setSheetOpen(true)
  }, [])

  const handleSheetClose = useCallback(() => {
    setSheetOpen(false)
    setEditUnit(null)
  }, [])

  const grouped = groupUnitsByCategory(filteredUnits)
  const customCount = units.filter((u) => u.type === 'CUSTOM').length

  return (
    <AppShell>
      <Header
        title={t.unit}
        backTo="/settings"
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            aria-label={t.addCustomUnitAria}
          >
            <Plus size={18} aria-hidden="true" />
            <span>{t.addUnitLabel}</span>
          </button>
        }
      />

      <PageContainer>
        {status === 'loading' && (
          <>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Skeleton height="3.5rem" borderRadius="var(--radius-md)" count={6} />
            </div>
          </>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldntLoadUnits}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && (
          <>
            {/* Tabs */}
            <nav className="pill-tabs" role="tablist" aria-label="Units sections">
              {UNITS_PAGE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeTab === 'units' && (
              <>
                {/* Search */}
                <input
                  type="search"
                  className="input unit-search"
                  placeholder={t.search}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  aria-label={t.search}
                  style={{ minHeight: '44px', marginTop: 'var(--space-3)' }}
                />

                {/* Summary */}
                <div className="unit-summary">
                  {t.unitsSummary.replace('{count}', String(units.length)).replace('{custom}', String(customCount))}
                </div>

                {/* Grouped unit list */}
                {filteredUnits.length === 0 ? (
                  <EmptyState
                    icon={<Ruler size={40} aria-hidden="true" />}
                    title={searchInput ? t.noMatchingUnits : t.noCustomUnitsYet}
                    description={
                      searchInput
                        ? t.tryDifferentSearchTerm
                        : t.addFirstCustomUnitCta
                    }
                    action={
                      !searchInput ? (
                        <button className="btn btn-primary btn-md" onClick={handleAdd}>
                          {t.addCustomUnitBtn}
                        </button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="unit-groups">
                    {Array.from(grouped.entries()).map(([category, catUnits]) => (
                      <div key={category} className="unit-group">
                        <h3 className="unit-group__title">
                          {UNIT_CATEGORY_LABELS[category]}
                        </h3>
                        {catUnits.map((unit) => (
                          <UnitListItem
                            key={unit.id}
                            unit={unit}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'conversions' && (
              <>
                {conversions.length === 0 ? (
                  <EmptyState
                    icon={<Ruler size={40} aria-hidden="true" />}
                    title={t.noConversionsYet}
                    description={t.setupConversions}
                  />
                ) : (
                  <div className="unit-groups">
                    {conversions.map((conv) => (
                      <ConversionListItem
                        key={conv.id}
                        conversion={conv}
                        onDelete={() => void handleDelete(conv.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </PageContainer>

      <AddUnitSheet
        open={sheetOpen}
        onClose={handleSheetClose}
        onSave={handleCreate}
        onUpdate={handleUpdate}
        editUnit={editUnit}
      />
    </AppShell>
  )
}
