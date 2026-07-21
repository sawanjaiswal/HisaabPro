/** Party Ledger — filter sheet: voucher-type chips + custom date range */

import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
        <div>
          <span className="ledger-filter-heading">{t.dateRange}</span>
          <div className="ledger-date-row">
            <div className="ledger-date-group">
              <label htmlFor="lf-from" className="ledger-date-label">{t.fromDate}</label>
              <Input
                id="lf-from"
                type="date"
                className="ledger-date-input"
                value={draftFrom}
                max={draftTo}
                onChange={(e) => setDraftFrom(e.target.value)}
                aria-label={t.ledgerFromDate}
              />
            </div>
            <div className="ledger-date-group">
              <label htmlFor="lf-to" className="ledger-date-label">{t.toDate}</label>
              <Input
                id="lf-to"
                type="date"
                className="ledger-date-input"
                value={draftTo}
                min={draftFrom}
                onChange={(e) => setDraftTo(e.target.value)}
                aria-label={t.ledgerToDate}
              />
            </div>
          </div>
        </div>

        <div>
          <span className="ledger-filter-heading">{t.voucherTypesLabel}</span>
          <div className="ledger-type-chips" role="group" aria-label={t.filterByVoucherType}>
            {ALL_TYPES.map(({ label, value }) => {
              const active = draftTypes.includes(value)
              return (
                <Button
                  variant="none"
                  key={value}
                  type="button"
                  className={`ledger-type-chip${active ? ' active' : ''}`}
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
          <div>
            <span className="ledger-filter-heading">{t.export}</span>
            <Button
              variant="outline"
              size="md"
              className="ledger-export-btn"
              onClick={onExport}
              disabled={isExporting}
              loading={isExporting}
              aria-label={t.downloadLedgerPDF}
            >
              <FileDown size={16} aria-hidden="true" />
              <span>{t.downloadLedgerPDF}</span>
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  )
}
