import { useState, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { createCheque } from '../cheque.service'
import type { ChequeType, CreateChequeInput } from '../cheque.types'
import { toLocalISODate } from '../../../lib/format'

const TODAY = toLocalISODate(new Date())

interface AddChequeDrawerProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddChequeDrawer({ open, onClose, onSuccess }: AddChequeDrawerProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<CreateChequeInput>({
    chequeNumber: '', bankName: '', type: 'RECEIVED', amount: 0, chequeDate: TODAY,
  })

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true); setFormError('')
    try {
      await createCheque({ ...form, amount: form.amount * 100 })
      toast.success(t.chequeAdded)
      setForm({ chequeNumber: '', bankName: '', type: 'RECEIVED', amount: 0, chequeDate: TODAY })
      onClose(); onSuccess()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : t.failedAddCheque)
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, onClose, onSuccess, t])

  return (
    <Drawer open={open} onClose={onClose} title={t.addCheque}>
      <form className="cheque-drawer__form" onSubmit={handleSubmit}>
        {formError && <p className="cheque-drawer__error" role="alert">{formError}</p>}
        <div className="cheque-drawer__row">
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqNumber">{t.chequeNumberLabel}</label>
            <input id="chqNumber" required className="cheque-drawer__input" value={form.chequeNumber} onChange={(e) => setForm((f) => ({ ...f, chequeNumber: e.target.value }))} placeholder={t.chequeNumberPlaceholder} />
          </div>
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqType">{t.type}</label>
            <select id="chqType" className="cheque-drawer__select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ChequeType }))}>
              <option value="RECEIVED">{t.received}</option>
              <option value="ISSUED">{t.issued}</option>
            </select>
          </div>
        </div>
        <div className="cheque-drawer__field">
          <label className="cheque-drawer__label" htmlFor="chqBank">{t.bankNameLabel}</label>
          <input id="chqBank" required className="cheque-drawer__input" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder={t.bankNamePlaceholder} />
        </div>
        <div className="cheque-drawer__row">
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqAmount">{t.amountRupees}</label>
            <input id="chqAmount" type="number" min="0.01" step="0.01" required className="cheque-drawer__input" value={form.amount || ''} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder={t.amountPlaceholder} />
          </div>
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqDate">{t.chequeDateLabel}</label>
            <input id="chqDate" type="date" required className="cheque-drawer__input" value={form.chequeDate} onChange={(e) => setForm((f) => ({ ...f, chequeDate: e.target.value }))} />
          </div>
        </div>
        <button type="submit" className="cheque-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
          {submitting ? t.saving : t.addCheque}
        </button>
      </form>
    </Drawer>
  )
}
