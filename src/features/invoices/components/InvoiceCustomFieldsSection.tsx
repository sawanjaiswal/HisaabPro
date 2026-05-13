/** Invoice — Additional Details (custom fields) section (#134) */

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'
import { queryKeys } from '@/lib/query-keys'
import {
  listCustomFieldDefsForDocType,
} from '../invoice-custom-fields.service'
import type { ApplicableDocumentType, DocumentCustomFieldDef } from '@/features/settings/document-custom-fields.service'
import type { DocumentType } from '../invoice-form.types'

/** Map full DocumentType → the subset that supports custom fields. */
function toApplicableDocType(t: DocumentType): ApplicableDocumentType | null {
  switch (t) {
    case 'SALE_INVOICE':     return 'INVOICE'
    case 'ESTIMATE':         return 'ESTIMATE'
    case 'SALE_ORDER':       return 'SALE_ORDER'
    case 'DELIVERY_CHALLAN': return 'DELIVERY_CHALLAN'
    default:                 return null
  }
}

interface Props {
  documentType: DocumentType
  values: Record<string, unknown>
  errors: Record<string, string>
  onChange: (values: Record<string, unknown>) => void
  onDefsLoaded?: (defs: DocumentCustomFieldDef[]) => void
}

export function InvoiceCustomFieldsSection({ documentType, values, errors, onChange, onDefsLoaded }: Props) {
  const { t } = useLanguage()
  const applicable = toApplicableDocType(documentType)

  const query = useQuery({
    queryKey: queryKeys.invoices.customFieldDefs(applicable ?? 'NONE'),
    queryFn: ({ signal }) => listCustomFieldDefsForDocType(applicable!, signal),
    enabled: !!applicable,
  })

  const defs = useMemo(() => query.data ?? [], [query.data])

  useEffect(() => {
    if (query.isSuccess) onDefsLoaded?.(defs)
  }, [query.isSuccess, defs, onDefsLoaded])

  if (!applicable) return null
  if (query.isPending) {
    return (
      <div className="line-items-section py-0">
        <div className="line-item-field">
          <div className="h-12 rounded-[var(--radius-md)] animate-pulse" style={{ backgroundColor: 'var(--color-gray-100)' }} />
        </div>
        <div className="line-item-field">
          <div className="h-12 rounded-[var(--radius-md)] animate-pulse" style={{ backgroundColor: 'var(--color-gray-100)' }} />
        </div>
      </div>
    )
  }
  if (defs.length === 0) return null

  function setValue(fieldId: string, value: unknown) {
    onChange({ ...values, [fieldId]: value })
  }

  return (
    <div className="line-items-section py-0">
      <h3 className="text-[var(--fs-lg)] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        {t.additionalDetails}
      </h3>

      {defs.map((def) => {
        const raw = values[def.id]
        const err = errors[def.id]
        return (
          <div key={def.id} className="line-item-field">
            <label className="label">
              {def.name}
              {def.required && (
                <span className="ml-1" style={{ color: 'var(--color-error-500)' }}>*</span>
              )}
            </label>

            {def.fieldType === 'TEXT' && (
              <input
                type="text"
                className="input"
                value={typeof raw === 'string' ? raw : ''}
                onChange={(e) => setValue(def.id, e.target.value)}
                maxLength={500}
              />
            )}
            {def.fieldType === 'NUMBER' && (
              <input
                type="number"
                inputMode="decimal"
                className="input"
                value={raw === undefined || raw === null ? '' : String(raw)}
                onChange={(e) => {
                  const v = e.target.value
                  setValue(def.id, v === '' ? undefined : Number(v))
                }}
              />
            )}
            {def.fieldType === 'DATE' && (
              <input
                type="date"
                className="input"
                value={typeof raw === 'string' ? raw : ''}
                onChange={(e) => setValue(def.id, e.target.value || undefined)}
              />
            )}
            {def.fieldType === 'DROPDOWN' && (
              <select
                className="input"
                value={typeof raw === 'string' ? raw : ''}
                onChange={(e) => setValue(def.id, e.target.value || undefined)}
              >
                <option value="">{t.selectOption}</option>
                {def.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {err && (
              <p className="mt-1 text-[var(--fs-xs)]" style={{ color: 'var(--color-error-500)' }}>
                {err}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
