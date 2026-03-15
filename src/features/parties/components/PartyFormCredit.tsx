/** Create Party — Credit & opening balance section */

import type { PartyFormData, BalanceType, CreditLimitMode } from '../party.types'

interface PartyFormCreditProps {
  form: PartyFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
}

const TODAY = new Date().toISOString().split('T')[0]

const BALANCE_TYPE_OPTIONS: { value: BalanceType; label: string }[] = [
  { value: 'RECEIVABLE', label: 'I Receive' },
  { value: 'PAYABLE', label: 'I Pay' },
]

const CREDIT_MODE_OPTIONS: { value: CreditLimitMode; label: string }[] = [
  { value: 'WARN', label: 'Warn' },
  { value: 'BLOCK', label: 'Block' },
]

export function PartyFormCredit({ form, errors, onUpdate }: PartyFormCreditProps) {
  const openingBalance = form.openingBalance
  const balanceType: BalanceType = openingBalance?.type ?? 'RECEIVABLE'

  const handleBalanceAmount = (raw: string) => {
    const amount = parseFloat(raw) || 0
    onUpdate('openingBalance', {
      amount,
      type: balanceType,
      asOfDate: openingBalance?.asOfDate ?? TODAY,
      notes: openingBalance?.notes,
    })
  }

  const handleBalanceType = (type: BalanceType) => {
    onUpdate('openingBalance', {
      amount: openingBalance?.amount ?? 0,
      type,
      asOfDate: openingBalance?.asOfDate ?? TODAY,
      notes: openingBalance?.notes,
    })
  }

  return (
    <div className="create-party-section">
      {/* Opening Balance */}
      <div className="input-group">
        <span className="input-label" id="opening-balance-label">Opening Balance</span>
        <div className="create-party-prefix-input">
          <span className="create-party-prefix" aria-hidden="true">Rs</span>
          <input
            id="opening-balance-amount"
            className="input create-party-input-prefixed"
            type="number"
            min="0"
            step="0.01"
            value={openingBalance?.amount ?? ''}
            onChange={e => handleBalanceAmount(e.target.value)}
            placeholder="0.00"
            aria-label="Opening balance amount in rupees"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="input-group">
        <span className="input-label" id="balance-type-label">Balance Direction</span>
        <div className="pill-tabs" role="group" aria-labelledby="balance-type-label">
          {BALANCE_TYPE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`pill-tab${balanceType === option.value ? ' active' : ''}`}
              onClick={() => handleBalanceType(option.value)}
              aria-pressed={balanceType === option.value}
              aria-label={option.label}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Limit */}
      <div className="input-group">
        <span className="input-label" id="credit-limit-label">Credit Limit</span>
        <div className="create-party-prefix-input">
          <span className="create-party-prefix" aria-hidden="true">Rs</span>
          <input
            id="credit-limit-amount"
            className={`input create-party-input-prefixed${errors.creditLimit ? ' input-error-border' : ''}`}
            type="number"
            min="0"
            step="0.01"
            value={form.creditLimit === 0 ? '' : form.creditLimit}
            onChange={e => onUpdate('creditLimit', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            aria-label="Credit limit in rupees"
            aria-describedby={errors.creditLimit ? 'credit-limit-error' : undefined}
            inputMode="decimal"
          />
        </div>
        {errors.creditLimit && (
          <p id="credit-limit-error" className="input-error" role="alert">
            {errors.creditLimit}
          </p>
        )}
      </div>

      <div className="input-group">
        <span className="input-label" id="credit-mode-label">When Limit Exceeded</span>
        <div className="pill-tabs" role="group" aria-labelledby="credit-mode-label">
          {CREDIT_MODE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`pill-tab${form.creditLimitMode === option.value ? ' active' : ''}`}
              onClick={() => onUpdate('creditLimitMode', option.value)}
              aria-pressed={form.creditLimitMode === option.value}
              aria-label={`Credit limit mode: ${option.label}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
