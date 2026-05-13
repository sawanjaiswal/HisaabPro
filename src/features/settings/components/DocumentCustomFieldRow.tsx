/** Document Custom Field — list row */

import { Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentCustomFieldDef } from '../document-custom-fields.service'

interface Props {
  field: DocumentCustomFieldDef
  onEdit: (field: DocumentCustomFieldDef) => void
  onDelete: (field: DocumentCustomFieldDef) => void
}

export function DocumentCustomFieldRow({ field, onEdit, onDelete }: Props) {
  const { t } = useLanguage()

  const typeLabel =
    field.fieldType === 'TEXT' ? t.fieldTypeText
      : field.fieldType === 'NUMBER' ? t.fieldTypeNumber
      : field.fieldType === 'DATE' ? t.fieldTypeDate
      : t.fieldTypeDropdown

  const docTypeLabels = field.documentTypes.map((d) =>
    d === 'INVOICE' ? t.applicableInvoice
    : d === 'ESTIMATE' ? t.applicableEstimate
    : d === 'SALE_ORDER' ? t.applicableSaleOrder
    : t.applicableDeliveryChallan,
  ).join(' · ')

  return (
    <div className="settings-item">
      <span className="settings-item-content">
        <span className="settings-item-label">
          {field.name}
          {field.required && (
            <span
              className="ml-2 text-[var(--fs-xs)] font-medium"
              style={{ color: 'var(--color-error-500)' }}
            >*</span>
          )}
        </span>
        <span className="settings-item-description">
          {typeLabel} · {docTypeLabels || t.appliesToDocuments}
        </span>
      </span>
      <span className="settings-item-action flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(field)}
          aria-label={t.editCustomField}
          className="p-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-gray-100)] transition-colors"
        >
          <Pencil className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(field)}
          aria-label={t.deleteCustomField}
          className="p-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-error-50)] transition-colors"
        >
          <Trash2 className="w-4 h-4" style={{ color: 'var(--color-error-500)' }} />
        </button>
      </span>
    </div>
  )
}
