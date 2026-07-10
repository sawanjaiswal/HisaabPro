/** Invoice list — search + document type pill filter bar + status filter.
 *
 * <768px: 3 primary type tabs + a "Filters" drawer holding the remaining
 * document types and all statuses (progressive disclosure — the long tail of
 * filter values stays reachable without eating scroll-off-screen real estate).
 * >=768px: every filter value shown inline (screen width is not scarce there).
 */

import React, { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentType, DocumentStatus } from '../invoice.types'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from '../invoice.constants'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Drawer } from '@/components/ui/Drawer'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'

interface InvoiceFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeType: DocumentType | 'ALL'
  onTypeChange: (type: DocumentType | 'ALL') => void
  activeStatus: DocumentStatus | 'ALL'
  onStatusChange: (status: DocumentStatus | 'ALL') => void
}

const DOCUMENT_TYPES: DocumentType[] = [
  'SALE_INVOICE',
  'PURCHASE_INVOICE',
  'ESTIMATE',
  'PROFORMA',
  'SALE_ORDER',
  'PURCHASE_ORDER',
  'DELIVERY_CHALLAN',
]

/** Highest-frequency types, always visible inline even on mobile */
const PRIMARY_TYPES: DocumentType[] = ['SALE_INVOICE', 'PURCHASE_INVOICE']
const OVERFLOW_TYPES = DOCUMENT_TYPES.filter((type) => !PRIMARY_TYPES.includes(type))

/** Only the statuses meaningful on a live list */
const STATUS_VALUES: Array<{ value: DocumentStatus | 'ALL'; labelKey?: 'all' }> = [
  { value: 'ALL', labelKey: 'all' },
  { value: 'SAVED' },
  { value: 'SHARED' },
  { value: 'DRAFT' },
  { value: 'CONVERTED' },
]

export const InvoiceFilterBar: React.FC<InvoiceFilterBarProps> = ({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
  activeStatus,
  onStatusChange,
}) => {
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draftType, setDraftType] = useState(activeType)
  const [draftStatus, setDraftStatus] = useState(activeStatus)

  const activeCount =
    (OVERFLOW_TYPES.includes(activeType as DocumentType) ? 1 : 0) +
    (activeStatus !== 'ALL' ? 1 : 0)

  const openDrawer = () => {
    setDraftType(activeType)
    setDraftStatus(activeStatus)
    setDrawerOpen(true)
  }

  const applyFilters = () => {
    onTypeChange(draftType)
    onStatusChange(draftStatus)
    setDrawerOpen(false)
  }

  const resetFilters = () => {
    setDraftType('ALL')
    setDraftStatus('ALL')
  }

  return (
    <div className="invoice-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchByPartyOrNumber}
          aria-label={t.searchInvoices}
        />
      </div>

      {/* Mobile: primary types + Filters drawer trigger */}
      <div className="flex md:hidden items-center gap-2">
        <Tabs value={activeType} onValueChange={(v) => onTypeChange(v as DocumentType | 'ALL')}>
          <TabsList aria-label={t.filterByDocType} className="pill-tabs-scroll rx-tabs-list--outlined">
            <TabsTrigger value="ALL">{t.all}</TabsTrigger>
            {PRIMARY_TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="sm"
          onClick={openDrawer}
          className="filter-drawer-trigger"
          aria-label={t.filters}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeCount > 0 && (
            <Badge variant="info" className="filter-drawer-badge">
              {String(activeCount)}
            </Badge>
          )}
        </Button>
      </div>

      {/* Desktop: every filter value inline */}
      <div className="hidden md:flex md:flex-col md:gap-3">
        <Tabs value={activeType} onValueChange={(v) => onTypeChange(v as DocumentType | 'ALL')}>
          <TabsList aria-label={t.filterByDocType} className="pill-tabs-scroll rx-tabs-list--outlined">
            <TabsTrigger value="ALL">{t.all}</TabsTrigger>
            {DOCUMENT_TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs value={activeStatus} onValueChange={(v) => onStatusChange(v as DocumentStatus | 'ALL')}>
          <TabsList aria-label={t.filterByStatus} className="pill-tabs-scroll rx-tabs-list--outlined">
            {STATUS_VALUES.map(({ value, labelKey }) => (
              <TabsTrigger key={value} value={value}>
                {labelKey === 'all' ? t.all : DOCUMENT_STATUS_LABELS[value as DocumentStatus]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t.filters}
        size="sm"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={resetFilters} className="flex-1">
              {t.resetFilters}
            </Button>
            <Button variant="primary" size="md" onClick={applyFilters} className="flex-1">
              {t.applyFilters}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <p className="filter-drawer-section-label">{t.filterByDocType}</p>
            <Tabs value={draftType} onValueChange={(v) => setDraftType(v as DocumentType | 'ALL')}>
              <TabsList aria-label={t.filterByDocType} className="pill-tabs-wrap rx-tabs-list--outlined">
                {OVERFLOW_TYPES.map((type) => (
                  <TabsTrigger key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div>
            <p className="filter-drawer-section-label">{t.filterByStatus}</p>
            <Tabs value={draftStatus} onValueChange={(v) => setDraftStatus(v as DocumentStatus | 'ALL')}>
              <TabsList aria-label={t.filterByStatus} className="pill-tabs-wrap rx-tabs-list--outlined">
                {STATUS_VALUES.map(({ value, labelKey }) => (
                  <TabsTrigger key={value} value={value}>
                    {labelKey === 'all' ? t.all : DOCUMENT_STATUS_LABELS[value as DocumentStatus]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
