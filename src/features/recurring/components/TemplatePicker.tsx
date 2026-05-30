/** TemplatePicker — searchable list of SAVED invoices to use as recurring template */

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, FileText, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { getDocuments } from '@/features/invoices/invoice.service'
import { formatPaise } from '@/lib/format'
import type { DocumentSummary } from '@/features/invoices/invoice-document.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface TemplatePickerProps {
  value: string
  onChange: (id: string, label: string) => void
  error?: string
}

export function TemplatePicker({ value, onChange, error }: TemplatePickerProps) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const query = useQuery({
    queryKey: ['template-picker', search],
    queryFn: ({ signal }) =>
      getDocuments({ status: 'SAVED', type: 'SALE_INVOICE', search, limit: 20 }, signal),
    enabled: open,
  })

  const docs: DocumentSummary[] = query.data?.documents ?? []
  const selectedDoc = docs.find((d) => d.id === value)

  const handleSelect = useCallback(
    (doc: DocumentSummary) => {
      const label = `${doc.documentNumber} — ${doc.party.name}`
      onChange(doc.id, label)
      setOpen(false)
    },
    [onChange]
  )

  return (
    <div className="rf-field">
      <label className="rf-label">
        {t.recurringTemplatePickerTitle ?? 'Select Template Invoice'}
        <span className="rf-required" aria-hidden="true"> *</span>
      </label>

      {/* Selected display / trigger */}
      <Button variant="none"
        type="button"
        className={`rf-template-btn${error ? ' rf-template-btn--error' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={
          selectedDoc
            ? `${t.recurringTemplatePickerSelected ?? 'Template selected'}: ${selectedDoc.documentNumber}`
            : t.recurringTemplatePickerTitle ?? 'Select Template Invoice'
        }
      >
        <FileText size={16} className="rf-template-btn__icon" aria-hidden="true" />
        <span className="rf-template-btn__text">
          {selectedDoc
            ? `${selectedDoc.documentNumber} — ${selectedDoc.party.name}`
            : (t.recurringTemplatePickerTitle ?? 'Select template invoice...')}
        </span>
        {selectedDoc && (
          <CheckCircle2 size={16} className="rf-template-btn__check" aria-hidden="true" />
        )}
      </Button>

      {error && (
        <p className="rf-error" role="alert">
          {t[error as keyof typeof t] ?? error}
        </p>
      )}

      {/* Picker modal / sheet */}
      {open && (
        <div
          className="rf-template-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.recurringTemplatePickerTitle ?? 'Select Template Invoice'}
        >
          <div className="rf-template-sheet">
            <div className="rf-template-sheet__header">
              <h2 className="rf-template-sheet__title">
                {t.recurringTemplatePickerTitle ?? 'Select Template Invoice'}
              </h2>
              <Button variant="none"
                type="button"
                className="rf-template-sheet__close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </Button>
            </div>

            <div className="rf-template-search">
              <Search size={16} aria-hidden="true" className="rf-template-search__icon" />
              <Input
                type="search"
                className="rf-template-search__input"
                placeholder={t.recurringTemplatePickerSearch ?? 'Search invoices...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="rf-template-list" role="list">
              {query.isPending && (
                <div className="rf-template-skeleton" aria-busy="true">
                  {(['s1', 's2', 's3'] as const).map((k) => (
                    <div key={k} className="rf-template-skeleton__row" />
                  ))}
                </div>
              )}

              {!query.isPending && docs.length === 0 && (
                <p className="rf-template-empty">
                  {t.recurringTemplatePickerEmpty ?? 'No saved invoices yet.'}
                </p>
              )}

              {docs.map((doc) => (
                <Button variant="none"
                  key={doc.id}
                  type="button"
                  role="listitem"
                  className={`rf-template-row${doc.id === value ? ' rf-template-row--selected' : ''}`}
                  onClick={() => handleSelect(doc)}
                >
                  <span className="rf-template-row__number">{doc.documentNumber}</span>
                  <span className="rf-template-row__party">{doc.party.name}</span>
                  <span className="rf-template-row__amount">{formatPaise(doc.grandTotal)}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
