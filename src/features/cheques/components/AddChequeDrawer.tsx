import { useState, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { createCheque } from '../cheque.service'
import type { ChequeType, CreateChequeInput } from '../cheque.types'

const TODAY = new Date().toISOString().split('T')[0]

interface AddChequeDrawerProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddChequeDrawer({ open, onClose, onSuccess }: AddChequeDrawerProps) {
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
      toast.success('Cheque added.')
      setForm({ chequeNumber: '', bankName: '', type: 'RECEIVED', amount: 0, chequeDate: TODAY })
      onClose(); onSuccess()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add cheque.')
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, onClose, onSuccess])

  return (
    <Drawer open={open} onClose={onClose} title="Add Cheque">
      <form className="cheque-drawer__form" onSubmit={handleSubmit}>
        {formError && <p className="cheque-drawer__error" role="alert">{formError}</p>}
        <div className="cheque-drawer__row">
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqNumber">Cheque Number</label>
            <input id="chqNumber" required className="cheque-drawer__input" value={form.chequeNumber} onChange={(e) => setForm((f) => ({ ...f, chequeNumber: e.target.value }))} placeholder="Cheque #" />
          </div>
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqType">Type</label>
            <select id="chqType" className="cheque-drawer__select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ChequeType }))}>
              <option value="RECEIVED">Received</option>
              <option value="ISSUED">Issued</option>
            </select>
          </div>
        </div>
        <div className="cheque-drawer__field">
          <label className="cheque-drawer__label" htmlFor="chqBank">Bank Name</label>
          <input id="chqBank" required className="cheque-drawer__input" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="e.g. HDFC Bank" />
        </div>
        <div className="cheque-drawer__row">
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqAmount">Amount (₹)</label>
            <input id="chqAmount" type="number" min="0.01" step="0.01" required className="cheque-drawer__input" value={form.amount || ''} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
          </div>
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqDate">Cheque Date</label>
            <input id="chqDate" type="date" required className="cheque-drawer__input" value={form.chequeDate} onChange={(e) => setForm((f) => ({ ...f, chequeDate: e.target.value }))} />
          </div>
        </div>
        <button type="submit" className="cheque-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Saving...' : 'Add Cheque'}
        </button>
      </form>
    </Drawer>
  )
}
