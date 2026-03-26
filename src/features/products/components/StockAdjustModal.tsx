/** Stock Adjust — Modal with type, quantity, reason */

import React, { useState, useCallback, useRef } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { adjustStock } from '../product.service'
import { STOCK_ADJUST_REASON_LABELS, CUSTOM_REASON_MAX, NOTES_MAX } from '../product.constants'
import type { StockAdjustType, StockAdjustReason, StockAdjustFormData } from '../product.types'

interface StockAdjustModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  productName: string
  unitSymbol: string
  onSuccess: () => void
}

const REASONS = Object.entries(STOCK_ADJUST_REASON_LABELS) as [StockAdjustReason, string][]

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  unitSymbol,
  onSuccess,
}) => {
  const toast = useToast()
  const { t } = useLanguage()
  const submittingRef = useRef(false)

  const [type, setType] = useState<StockAdjustType>('ADJUSTMENT_IN')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<StockAdjustReason>('AUDIT')
  const [customReason, setCustomReason] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = useCallback(() => {
    setType('ADJUSTMENT_IN')
    setQuantity('')
    setReason('AUDIT')
    setCustomReason('')
    setNotes('')
    setErrors({})
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}
    const qty = parseFloat(quantity)

    if (!quantity || isNaN(qty) || qty <= 0) {
      next.quantity = t.quantityGtZero
    }
    if (reason === 'OTHER' && !customReason.trim()) {
      next.customReason = t.pleaseSpecifyReason
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [quantity, reason, customReason])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    if (submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)

    const payload: StockAdjustFormData = {
      type,
      quantity: parseFloat(quantity),
      reason,
      customReason: reason === 'OTHER' ? customReason.trim() : undefined,
      notes: notes.trim() || undefined,
    }

    try {
      await adjustStock(productId, payload)
      const label = type === 'ADJUSTMENT_IN' ? t.addedTo : t.removedFrom
      toast.success(`${quantity} ${unitSymbol} ${label} ${productName}`)
      handleClose()
      onSuccess()
    } catch {
      toast.error(t.failedAdjustStock)
    } finally {
      setIsSubmitting(false)
      submittingRef.current = false
    }
  }, [type, quantity, reason, customReason, notes, productId, productName, unitSymbol, validate, toast, handleClose, onSuccess])

  return (
    <Modal open={isOpen} onClose={handleClose} title={t.adjustStock}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="input-group">
          <span className="input-label" id="adjust-type-label">{t.typeLabel}</span>
          <div className="pill-tabs" role="group" aria-labelledby="adjust-type-label">
            <button
              type="button"
              className={`pill-tab${type === 'ADJUSTMENT_IN' ? ' active' : ''}`}
              onClick={() => setType('ADJUSTMENT_IN')}
              aria-pressed={type === 'ADJUSTMENT_IN'}
              aria-label={t.addStockLabel}
            >
              <Plus size={14} aria-hidden="true" style={{ marginRight: 'var(--space-1)' }} /> {t.stockIn}
            </button>
            <button
              type="button"
              className={`pill-tab${type === 'ADJUSTMENT_OUT' ? ' active' : ''}`}
              onClick={() => setType('ADJUSTMENT_OUT')}
              aria-pressed={type === 'ADJUSTMENT_OUT'}
              aria-label={t.removeStockLabel}
            >
              <Minus size={14} aria-hidden="true" style={{ marginRight: 'var(--space-1)' }} /> {t.stockOut}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="adjust-quantity" className="input-label">{t.qty} ({unitSymbol})</label>
          <input
            id="adjust-quantity"
            className={`input${errors.quantity ? ' input-error-border' : ''}`}
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value)
              if (errors.quantity) setErrors((prev) => { const n = { ...prev }; delete n.quantity; return n })
            }}
            placeholder="0"
            inputMode="decimal"
            aria-label={`${t.quantityIn} ${unitSymbol}`}
          />
          {errors.quantity && <p className="input-error" role="alert">{errors.quantity}</p>}
        </div>

        <div className="input-group">
          <label htmlFor="adjust-reason" className="input-label">{t.reasonLabel}</label>
          <select
            id="adjust-reason"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value as StockAdjustReason)}
            aria-label={t.selectReasonLabel}
          >
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {reason === 'OTHER' && (
          <div className="input-group">
            <label htmlFor="adjust-custom-reason" className="input-label">{t.specifyReasonLabel}</label>
            <input
              id="adjust-custom-reason"
              className={`input${errors.customReason ? ' input-error-border' : ''}`}
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value)
                if (errors.customReason) setErrors((prev) => { const n = { ...prev }; delete n.customReason; return n })
              }}
              placeholder={t.enterReason}
              maxLength={CUSTOM_REASON_MAX}
              aria-label={t.customReasonLabel}
            />
            {errors.customReason && <p className="input-error" role="alert">{errors.customReason}</p>}
          </div>
        )}

        <div className="input-group">
          <label htmlFor="adjust-notes" className="input-label">
            {t.notesLabel} <span style={{ color: 'var(--color-gray-400)', fontWeight: 400 }}>({t.notesOptionalLabel})</span>
          </label>
          <textarea
            id="adjust-notes"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.additionalNotes}
            rows={2}
            maxLength={NOTES_MAX}
            aria-label={t.notesForAdjustment}
            style={{ resize: 'vertical', height: 'auto', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)' }}
          />
        </div>

        <Button
          variant="primary"
          size="md"
          loading={isSubmitting}
          onClick={handleSubmit}
          aria-label={t.confirmStockAdjust}
          style={{ width: '100%' }}
        >
          {type === 'ADJUSTMENT_IN' ? t.addStockBtn : t.removeStockBtn}
        </Button>
      </div>
    </Modal>
  )
}
