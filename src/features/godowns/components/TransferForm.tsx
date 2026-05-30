/** TransferForm — Stock transfer between godowns */

import { useLanguage } from '@/hooks/useLanguage'
import { TRANSFER_NOTES_MAX } from '../godown.constants'
import type { TransferStockData, Godown } from '../godown.types'
import { Button } from '@/components/ui/Button'
import { Select, SelectItem } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'

interface TransferFormProps {
  form: TransferStockData
  errors: Record<string, string>
  isSubmitting: boolean
  godowns: Godown[]
  onUpdate: <K extends keyof TransferStockData>(key: K, value: TransferStockData[K]) => void
  onSubmit: () => void
}

export function TransferForm({ form, errors, isSubmitting, godowns, onUpdate, onSubmit }: TransferFormProps) {
  const { t } = useLanguage()
  return (
    <form
      className="godown-form"
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      noValidate
    >
      <div className="godown-form__field">
        <label htmlFor="transfer-product" className="godown-form__label">
          {t.productId} <span aria-hidden="true">*</span>
        </label>
        <Input
          id="transfer-product"
          type="text"
          className={`godown-form__input${errors.productId ? ' godown-form__input--error' : ''}`}
          value={form.productId}
          onChange={(e) => onUpdate('productId', e.target.value)}
          placeholder={t.enterProductId}
          aria-required="true"
          aria-invalid={Boolean(errors.productId)}
          aria-describedby={errors.productId ? 'transfer-product-error' : undefined}
        />
        {errors.productId && (
          <p id="transfer-product-error" className="godown-form__error" role="alert">{errors.productId}</p>
        )}
        <p className="godown-form__hint">{t.productIdHint}</p>
      </div>

      <div className="godown-form__field">
        <label htmlFor="transfer-from" className="godown-form__label">
          {t.fromGodown} <span aria-hidden="true">*</span>
        </label>
        <Select
          value={form.fromGodownId || undefined}
          onValueChange={(v) => onUpdate('fromGodownId', v)}
          ariaLabel={t.fromGodown}
          placeholder={t.selectSourceGodown}
        >
          {godowns.map((g) => (
            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
          ))}
        </Select>
        {errors.fromGodownId && (
          <p id="transfer-from-error" className="godown-form__error" role="alert">{errors.fromGodownId}</p>
        )}
      </div>

      <div className="godown-form__field">
        <label htmlFor="transfer-to" className="godown-form__label">
          {t.toGodown} <span aria-hidden="true">*</span>
        </label>
        <Select
          value={form.toGodownId || undefined}
          onValueChange={(v) => onUpdate('toGodownId', v)}
          ariaLabel={t.toGodown}
          placeholder={t.selectDestGodown}
        >
          {godowns.map((g) => (
            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
          ))}
        </Select>
        {errors.toGodownId && (
          <p id="transfer-to-error" className="godown-form__error" role="alert">{errors.toGodownId}</p>
        )}
      </div>

      <div className="godown-form__field">
        <label htmlFor="transfer-qty" className="godown-form__label">
          {t.quantity} <span aria-hidden="true">*</span>
        </label>
        <Input
          id="transfer-qty"
          type="number"
          inputMode="numeric"
          step="1"
          className={`godown-form__input${errors.quantity ? ' godown-form__input--error' : ''}`}
          value={form.quantity || ''}
          onChange={(e) => onUpdate('quantity', Number(e.target.value))}
          placeholder="0"
          min={1}
          aria-required="true"
          aria-invalid={Boolean(errors.quantity)}
          aria-describedby={errors.quantity ? 'transfer-qty-error' : undefined}
        />
        {errors.quantity && (
          <p id="transfer-qty-error" className="godown-form__error" role="alert">{errors.quantity}</p>
        )}
      </div>

      <div className="godown-form__field">
        <label htmlFor="transfer-batch" className="godown-form__label">{t.batchIdLabelSimple}</label>
        <Input
          id="transfer-batch"
          type="text"
          className="godown-form__input"
          value={form.batchId ?? ''}
          onChange={(e) => onUpdate('batchId', e.target.value)}
          placeholder={t.batchId}
        />
      </div>

      <div className="godown-form__field">
        <label htmlFor="transfer-notes" className="godown-form__label">{t.notes}</label>
        <Textarea
          id="transfer-notes"
          className="godown-form__textarea"
          value={form.notes ?? ''}
          onChange={(e) => onUpdate('notes', e.target.value)}
          placeholder={t.transferNotes}
          maxLength={TRANSFER_NOTES_MAX}
          rows={2}
        />
      </div>

      <Button
        type="submit"
        variant="primary" size="lg" className="godown-form__submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? t.transferring : t.transferStock}
      </Button>
    </form>
  )
}
