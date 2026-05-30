/** Convert Document — target-type picker drawer (#122) */

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { convertDocument } from '../invoice.service'
import { ALLOWED_CONVERSIONS, DOCUMENT_TYPE_LABELS } from '../invoice.constants'
import type { DocumentType } from '../invoice-form.types'
import type { ConversionTargetType } from '../invoice-api.types'

interface Props {
  open: boolean
  onClose: () => void
  documentId: string
  sourceType: DocumentType
  onConverted: (newDocumentId: string) => void
}

export function ConvertDocumentDrawer({ open, onClose, documentId, sourceType, onConverted }: Props) {
  const { t } = useLanguage()
  const toast = useToast()
  const targets = (ALLOWED_CONVERSIONS[sourceType] ?? []) as ConversionTargetType[]

  const [target, setTarget] = useState<ConversionTargetType | null>(targets[0] ?? null)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (!target) return
    setSubmitting(true)
    try {
      const newDoc = await convertDocument(documentId, target)
      toast.success(t.convertedToDraft)
      onConverted(newDoc.id)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.convertFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.convertDocument}
      footer={
        <Button
          variant="primary"
          onClick={handleConfirm}
          loading={submitting}
          disabled={!target}
          className="w-full"
        >
          {t.convertCta}
        </Button>
      }
    >
      <div className="space-y-4 px-1 py-2">
        <p className="text-[var(--fs-sm)]" style={{ color: 'var(--text-secondary)' }}>
          {t.convertFromLabel}: <strong style={{ color: 'var(--text-primary)' }}>{DOCUMENT_TYPE_LABELS[sourceType]}</strong>
        </p>

        <div>
          <label className="block text-[var(--fs-sm)] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {t.convertToLabel}
          </label>
          <div className="grid grid-cols-1 gap-2">
            {targets.map((tt) => {
              const selected = target === tt
              return (
                <Button variant="none"
                  key={tt}
                  type="button"
                  onClick={() => setTarget(tt)}
                  className="flex items-center justify-between px-3 py-3 border rounded-[var(--radius-md)] transition-all text-left"
                  style={{
                    borderColor: selected ? 'var(--color-primary-500)' : 'var(--color-gray-200)',
                    backgroundColor: selected ? 'var(--color-primary-100)' : 'var(--color-gray-0)',
                    color: selected ? 'var(--color-primary-700)' : 'var(--text-primary)',
                  }}
                >
                  <span className="text-[var(--fs-df)] font-medium">{DOCUMENT_TYPE_LABELS[tt]}</span>
                  <ArrowRight className="w-4 h-4" style={{ color: selected ? 'var(--color-primary-700)' : 'var(--text-muted)' }} />
                </Button>
              )
            })}
          </div>
        </div>

        <p className="text-[var(--fs-xs)]" style={{ color: 'var(--text-muted)' }}>
          {t.convertNote}
        </p>
      </div>
    </Drawer>
  )
}
