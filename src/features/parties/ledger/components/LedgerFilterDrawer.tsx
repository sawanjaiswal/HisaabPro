/** Party Ledger — filter sheet: voucher-type chips + custom date range */

import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DateField } from '@/components/ui/DateField'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import type { LedgerVoucherType } from '../ledger.types'

interface LedgerFilterDrawerProps {
  open: boolean
  onClose: () => void
  from: string
  to: string
  selectedTypes: LedgerVoucherType[]
  /** Commit the draft filters back to the ledger hook. */
  onApply: (from: string, to: string, types: LedgerVoucherType[]) => void
  /**
   * PDF export — lives here rather than in the toolbar because a search field
   * plus three icons does not fit at 320px, and exporting is an occasional
   * action. Omitted when there is nothing to export.
   */
  onExport?: () => void
  isExporting?: boolean
}

const ALL_TYPES: { label: string; value: LedgerVoucherType }[] = [
  { label: 'Sale',        value: 'SALE' },
  { label: 'Purchase',    value: 'PURCHASE' },
  { label: 'Payment',     value: 'PAYMENT' },
  { label: 'Receipt',     value: 'RECEIPT' },
  { label: 'Credit Note', value: 'CREDIT_NOTE' },
  { label: 'Debit Note',  value: 'DEBIT_NOTE' },
  { label: 'Journal',     value: 'JOURNAL' },
]

export function LedgerFilterDrawer({
  open, onClose, from, to, selectedTypes, onApply, onExport, isExporting = false,
}: LedgerFilterDrawerProps) {
  const { t } = useLanguage()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [draftTypes, setDraftTypes] = useState<LedgerVoucherType[]>(selectedTypes)

  // Reset drafts to the live filters each time the sheet opens.
  useEffect(() => {
    if (open) {
      setDraftFrom(from)
      setDraftTo(to)
      setDraftTypes(selectedTypes)
    }
  }, [open, from, to, selectedTypes])

  const toggleType = (type: LedgerVoucherType) => {
    setDraftTypes((prev) =>
      prev.includes(type) ? prev.filter((v) => v !== type) : [...prev, type],
    )
  }

  const handleApply = () => {
    onApply(draftFrom, draftTo, draftTypes)
    onClose()
  }

  const handleClear = () => {
    setDraftTypes([])
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.filters}
      footer={
        <div className="ledger-filter-footer">
          <Button variant="outline" size="md" onClick={handleClear} className="flex-1">
            {t.clearFilters}
          </Button>
          <Button variant="primary" size="md" onClick={handleApply} className="flex-1">
            {t.applyFilters}
          </Button>
        </div>
      }
    >
      <div className="ledger-filter-body">
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t.dateRange}
            </span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.dateRange ?? 'Date Range'}>
              {[
                {
                  label: t.last90Days || 'Last 90 Days',
                  from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
                  to: new Date().toISOString().slice(0, 10),
                },
                {
                  label: t.last30Days || 'Last 30 Days',
                  from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
                  to: new Date().toISOString().slice(0, 10),
                },
                {
                  label: t.thisMonth || 'This Month',
                  from: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10),
                  to: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).toISOString().slice(0, 10),
                },
                {
                  label: t.viewAll || t.all || 'All Time',
                  from: '2020-01-01',
                  to: new Date().toISOString().slice(0, 10),
                },
              ].map((p) => {
                const active = draftFrom === p.from && draftTo === p.to
                return (
                  <Button
                    variant={active ? 'primary' : 'outline'}
                    size="sm"
                    key={p.label}
                    onClick={() => {
                      setDraftFrom(p.from)
                      setDraftTo(p.to)
                    }}
                  >
                    <span>{p.label}</span>
                  </Button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <DateField
                id="lf-from"
                label={t.fromDate}
                value={draftFrom}
                max={draftTo}
                onChange={(e) => setDraftFrom(e.target.value)}
                aria-label={t.ledgerFromDate}
              />
              <DateField
                id="lf-to"
                label={t.toDate}
                value={draftTo}
                min={draftFrom}
                onChange={(e) => setDraftTo(e.target.value)}
                aria-label={t.ledgerToDate}
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t.voucherTypesLabel}
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t.filterByVoucherType}>
              {ALL_TYPES.map(({ label, value }) => {
                const active = draftTypes.includes(value)
                return (
                  <Button
                    variant={active ? 'primary' : 'outline'}
                    size="sm"
                    key={value}
                    type="button"
                    className="!rounded-full"
                    onClick={() => toggleType(value)}
                    aria-pressed={active}
                    aria-label={`${active ? t.remove : t.add} ${label} ${t.filter}`}
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>

          {onExport && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-gray-200)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t.export}
              </span>
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={onExport}
                disabled={isExporting}
                loading={isExporting}
                aria-label={t.downloadLedgerPDF}
              >
                <FileDown size={16} aria-hidden="true" className="mr-2" />
                <span>{t.downloadLedgerPDF}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}
