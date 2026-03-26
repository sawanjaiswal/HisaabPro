/** Bank Accounts — List Page
 *
 * Shows all bank accounts with balance display.
 * Inline drawer for adding new accounts.
 * 4 UI states: loading skeleton · error · empty · success.
 */

import { useState, useCallback } from 'react'
import { Building2, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { useBankAccounts } from './useBankAccounts'
import { createBankAccount } from './bank-account.service'
import type { BankAccount, BankAccountType, CreateBankAccountInput } from './bank-account.types'
import './bank-accounts.css'
import { useLanguage } from '@/hooks/useLanguage'

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  SAVINGS: 'Savings',
  CURRENT: 'Current',
  OVERDRAFT: 'Overdraft',
  CASH: 'Cash',
}

function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num
  return 'xxxx ' + num.slice(-4)
}

function BankAccountCard({ account }: { account: BankAccount }) {
  const { t } = useLanguage()
  return (
    <div className="bank-card" role="article" aria-label={`${account.bankName} account`}>
      <div className="bank-card__header">
        <div className="bank-card__info">
          <span className="bank-card__name">{account.bankName}</span>
          <span className="bank-card__number">{maskAccountNumber(account.accountNumber)}</span>
        </div>
        <span className={`bank-card__type-badge${account.isDefault ? ' bank-card__type-badge--default' : ''}`}>
          {account.isDefault ? t.defaultAccount : ACCOUNT_TYPE_LABELS[account.accountType]}
        </span>
      </div>
      <div className={`bank-card__balance${account.currentBalance < 0 ? ' bank-card__balance--negative' : ''}`}>
        {formatPaise(account.currentBalance)}
      </div>
    </div>
  )
}

export default function BankAccountsPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const { items, total, status, refresh } = useBankAccounts()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<CreateBankAccountInput>({
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
    ifscCode: '',
    accountType: 'SAVINGS',
    openingBalance: 0,
    isDefault: false,
  })

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setFormError('')
    try {
      await createBankAccount({ ...form, openingBalance: (form.openingBalance ?? 0) * 100 })
      toast.success('Bank account added.')
      setDrawerOpen(false)
      setForm({ bankName: '', accountNumber: '', accountHolderName: '', ifscCode: '', accountType: 'SAVINGS', openingBalance: 0, isDefault: false })
      refresh()
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to add account.'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, refresh])

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.bankAccounts ?? "Bank Accounts"} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <div className="bank-skeleton" aria-busy="true" aria-label={t.loadingAccounts2}>
            {(['sk-1', 'sk-2', 'sk-3'] as const).map((key) => (
              <div key={key} className="bank-skeleton__card" />
            ))}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.bankAccounts ?? "Bank Accounts"} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadBankAccounts} message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.bankAccounts ?? "Bank Accounts"} backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <div className="bank-action-bar">
          <span className="bank-count">{total} {total === 1 ? 'account' : 'accounts'}</span>
          <button type="button" className="bank-add-btn" onClick={() => setDrawerOpen(true)} aria-label={t.addFirstAccount}>
            <Plus size={14} aria-hidden="true" /> Add Account
          </button>
        </div>

        {items.length === 0 && (
          <div className="bank-empty">
            <div className="bank-empty__icon" aria-hidden="true"><Building2 size={32} /></div>
            <p className="bank-empty__title">{t.noBankAccounts}</p>
            <p className="bank-empty__desc">{t.addBankAccountsDesc}</p>
            <button type="button" className="bank-add-btn" onClick={() => setDrawerOpen(true)}>
              <Plus size={14} aria-hidden="true" /> Add First Account
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="bank-list">
            {items.map((account) => <BankAccountCard key={account.id} account={account} />)}
          </div>
        )}
      </PageContainer>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t.addFirstAccount}>
        <form className="bank-drawer__form" onSubmit={handleSubmit}>
          {formError && <p className="bank-drawer__error" role="alert">{formError}</p>}
          <div className="bank-drawer__field">
            <label className="bank-drawer__label" htmlFor="bankName">{t.bankNameLabel2}</label>
            <input id="bankName" className="bank-drawer__input" required value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="e.g. SBI, HDFC" />
          </div>
          <div className="bank-drawer__row">
            <div className="bank-drawer__field">
              <label className="bank-drawer__label" htmlFor="accountNumber">{t.accountNumberLabel}</label>
              <input id="accountNumber" className="bank-drawer__input" required value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} placeholder="Account no." />
            </div>
            <div className="bank-drawer__field">
              <label className="bank-drawer__label" htmlFor="accountType">Type</label>
              <select id="accountType" className="bank-drawer__select" value={form.accountType} onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value as BankAccountType }))}>
                {(Object.keys(ACCOUNT_TYPE_LABELS) as BankAccountType[]).map((t) => (
                  <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bank-drawer__field">
            <label className="bank-drawer__label" htmlFor="accountHolder">{t.accountHolderName}</label>
            <input id="accountHolder" className="bank-drawer__input" required value={form.accountHolderName} onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))} />
          </div>
          <div className="bank-drawer__row">
            <div className="bank-drawer__field">
              <label className="bank-drawer__label" htmlFor="ifscCode">{t.ifscCode}</label>
              <input id="ifscCode" className="bank-drawer__input" value={form.ifscCode ?? ''} onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value }))} placeholder="e.g. SBIN0001234" />
            </div>
            <div className="bank-drawer__field">
              <label className="bank-drawer__label" htmlFor="openingBalance">{t.openingBalanceRs}</label>
              <input id="openingBalance" type="number" min="0" step="0.01" className="bank-drawer__input" value={form.openingBalance ?? 0} onChange={(e) => setForm((f) => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <label className="bank-drawer__toggle">
            <input type="checkbox" checked={form.isDefault ?? false} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
            <span className="bank-drawer__toggle-label">{t.setAsDefault}</span>
          </label>
          <button type="submit" className="bank-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
            {submitting ? t.adding : t.addFirstAccount}
          </button>
        </form>
      </Drawer>
    </AppShell>
  )
}
