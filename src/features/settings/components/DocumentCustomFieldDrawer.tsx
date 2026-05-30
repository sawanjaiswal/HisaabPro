/** Document Custom Field — create/edit drawer (#134) */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import type {
  ApplicableDocumentType,
  CreateDocumentCustomFieldInput,
  CustomFieldType,
  DocumentCustomFieldDef,
  UpdateDocumentCustomFieldInput,
} from '../document-custom-fields.service'
import { Textarea } from '@/components/ui/Textarea'

const DOC_TYPES: ApplicableDocumentType[] = ['INVOICE', 'ESTIMATE', 'SALE_ORDER', 'DELIVERY_CHALLAN']
const FIELD_TYPES: CustomFieldType[] = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN']

interface Props {
  open: boolean
  onClose: () => void
  editing: DocumentCustomFieldDef | null
  onCreate: (data: CreateDocumentCustomFieldInput) => Promise<unknown>
  onUpdate: (args: { id: string; data: UpdateDocumentCustomFieldInput }) => Promise<unknown>
  saving: boolean
}

export function DocumentCustomFieldDrawer({ open, onClose, editing, onCreate, onUpdate, saving }: Props) {
  const { t } = useLanguage()
  const toast = useToast()

  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('TEXT')
  const [documentTypes, setDocumentTypes] = useState<ApplicableDocumentType[]>(['INVOICE'])
  const [required, setRequired] = useState(false)
  const [optionsText, setOptionsText] = useState('')
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setFieldType(editing?.fieldType ?? 'TEXT')
      setDocumentTypes(editing?.documentTypes ?? ['INVOICE'])
      setRequired(editing?.required ?? false)
      setOptionsText((editing?.options ?? []).join('\n'))
      setNameError('')
    }
  }, [open, editing])

  function toggleDocType(d: ApplicableDocumentType) {
    setDocumentTypes((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  const fieldTypeLabel = (ty: CustomFieldType) =>
    ty === 'TEXT' ? t.fieldTypeText : ty === 'NUMBER' ? t.fieldTypeNumber
    : ty === 'DATE' ? t.fieldTypeDate : t.fieldTypeDropdown

  const docTypeLabel = (d: ApplicableDocumentType) =>
    d === 'INVOICE' ? t.applicableInvoice : d === 'ESTIMATE' ? t.applicableEstimate
    : d === 'SALE_ORDER' ? t.applicableSaleOrder : t.applicableDeliveryChallan

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { setNameError(t.fieldNameRequired); return }
    const opts = fieldType === 'DROPDOWN'
      ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
      : []
    if (fieldType === 'DROPDOWN' && opts.length === 0) {
      toast.error(t.dropdownNeedsOptions); return
    }
    try {
      if (editing) {
        await onUpdate({ id: editing.id, data: { name: trimmed, options: opts, required, documentTypes } })
      } else {
        await onCreate({ name: trimmed, fieldType, options: opts, required, documentTypes })
      }
      onClose()
    } catch { /* error toast surfaced by hook */ }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? t.editCustomField : t.addCustomField}
      footer={
        <Button variant="primary" onClick={handleSave} loading={saving} className="w-full">
          {t.saveField}
        </Button>
      }
    >
      <div className="space-y-4 px-1 py-2">
        <Input
          label={t.fieldNameLabel}
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError('') }}
          error={nameError}
          maxLength={64}
          autoFocus
        />

        <div>
          <label className="block text-[var(--fs-sm)] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {t.fieldTypeLabel}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((ty) => {
              const selected = fieldType === ty
              const isEditingLock = !!editing && fieldType !== ty
              return (
                <Button variant="none"
                  key={ty}
                  type="button"
                  disabled={isEditingLock}
                  onClick={() => setFieldType(ty)}
                  className="px-3 py-2.5 border rounded-[var(--radius-sm)] transition-all min-h-[44px] text-[var(--fs-sm)] font-medium"
                  style={{
                    borderColor: selected ? 'var(--color-primary-500)' : 'var(--color-gray-200)',
                    backgroundColor: selected ? 'var(--color-primary-100)' : 'var(--color-gray-0)',
                    color: selected ? 'var(--color-primary-700)' : 'var(--text-primary)',
                    opacity: isEditingLock ? 0.4 : 1,
                  }}
                >
                  {fieldTypeLabel(ty)}
                </Button>
              )
            })}
          </div>
        </div>

        {fieldType === 'DROPDOWN' && (
          <div>
            <label className="block text-[var(--fs-sm)] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t.dropdownOptionsLabel}
            </label>
            <Textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={4}
              className="w-full px-3 py-3 border rounded-[var(--radius-md)] focus:outline-none focus:ring-2 transition-all text-[var(--fs-df)]"
              style={{
                backgroundColor: 'var(--color-gray-0)',
                borderColor: 'var(--color-gray-200)',
                color: 'var(--text-primary)',
                ['--tw-ring-color' as string]: 'var(--color-primary-400)',
              }}
              placeholder={'Option 1\nOption 2'}
            />
          </div>
        )}

        <div>
          <label className="block text-[var(--fs-sm)] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {t.appliesToDocuments}
          </label>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.map((d) => {
              const selected = documentTypes.includes(d)
              return (
                <Button variant="none"
                  key={d}
                  type="button"
                  onClick={() => toggleDocType(d)}
                  className="px-3 py-1.5 border rounded-full text-[var(--fs-sm)] font-medium transition-all"
                  style={{
                    borderColor: selected ? 'var(--color-primary-500)' : 'var(--color-gray-200)',
                    backgroundColor: selected ? 'var(--color-primary-100)' : 'var(--color-gray-0)',
                    color: selected ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  }}
                >
                  {docTypeLabel(d)}
                </Button>
              )
            })}
          </div>
        </div>

        <label className="settings-item settings-item--toggle !px-0">
          <span className="settings-item-content">
            <span className="settings-item-label">{t.fieldRequiredLabel}</span>
            <span className="settings-item-description">{t.fieldRequiredDesc}</span>
          </span>
          <span className="settings-item-action">
            <span className="settings-toggle">
              <Input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                aria-label={t.fieldRequiredLabel}
              />
              <span className="settings-toggle-track" />
            </span>
          </span>
        </label>
      </div>
    </Drawer>
  )
}
