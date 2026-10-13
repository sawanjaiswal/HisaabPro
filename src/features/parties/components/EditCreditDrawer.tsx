import React, { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { Text } from '@/components/ui/Text'
import { useLanguage } from '@/hooks/useLanguage'
import { CreditCard, ShieldAlert } from 'lucide-react'
import type { CreditLimitMode } from '../party.types'

interface EditCreditDrawerProps {
  open: boolean
  onClose: () => void
  currentLimit: number // in paise
  currentMode: CreditLimitMode
  onSave?: (limitPaise: number, mode: CreditLimitMode) => Promise<void> | void
}

export function EditCreditDrawer({
  open,
  onClose,
  currentLimit,
  currentMode,
  onSave,
}: EditCreditDrawerProps) {
  const { t } = useLanguage()

  const [limitType, setLimitType] = useState<'NONE' | 'CUSTOM'>('NONE')
  const [amountRupees, setAmountRupees] = useState<string>('')
  const [mode, setMode] = useState<CreditLimitMode>('WARN')
  const [isSaving, setIsSaving] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const hasLimit = currentLimit > 0
      setLimitType(hasLimit ? 'CUSTOM' : 'NONE')
      setAmountRupees(hasLimit ? String(currentLimit / 100) : '')
      setMode(currentMode || 'WARN')
      setIsSaving(false)
      setAmountError(null)
    }
  }, [open, currentLimit, currentMode])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    let finalPaise = 0

    if (limitType === 'CUSTOM') {
      const parsedRupees = parseFloat(amountRupees)
      if (isNaN(parsedRupees) || parsedRupees <= 0) {
        setAmountError('Please enter an amount greater than ₹0')
        return
      }
      setAmountError(null)
      finalPaise = Math.round(parsedRupees * 100)
    }

    try {
      setIsSaving(true)
      if (onSave) {
        await onSave(finalPaise, mode)
      }
      onClose()
    } catch (err) {
      console.error('Failed to update credit settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const footer = (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={isSaving}
        onClick={onClose}
      >
        {t.cancel ?? 'Cancel'}
      </Button>
      <Button
        type="button"
        variant="primary"
        loading={isSaving}
        disabled={isSaving}
        onClick={() => handleSave()}
      >
        {t.save ?? 'Save'}
      </Button>
    </>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.creditInfo ?? 'Credit'}
      size="md"
      footer={footer}
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Unified Card Container */}
        <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs divide-y divide-[var(--color-gray-100)]">
          {/* Row 1: Credit Limit Type */}
          <div className="pb-4 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-[var(--color-primary-600)]" />
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {t.creditLimit ?? 'Credit Limit'}
              </label>
            </div>

            <div className="pill-tabs" role="group" aria-label={t.creditLimit ?? 'Credit Limit'}>
              <Button
                variant="none"
                type="button"
                className={`pill-tab${limitType === 'NONE' ? ' active' : ''}`}
                onClick={() => {
                  setLimitType('NONE')
                  setAmountRupees('')
                }}
              >
                {t.noLimit ?? 'No limit'}
              </Button>
              <Button
                variant="none"
                type="button"
                className={`pill-tab${limitType === 'CUSTOM' ? ' active' : ''}`}
                onClick={() => {
                  setLimitType('CUSTOM')
                  if (!amountRupees) setAmountRupees('50000')
                }}
              >
                Custom Limit
              </Button>
            </div>
          </div>

          {/* Row 2: Amount Input (only if custom ceiling) */}
          {limitType === 'CUSTOM' && (
            <div className="py-4">
              <FormField
                label={t.creditLimitInRupees ?? 'Maximum Credit Allowed'}
                htmlFor="credit-limit-input"
                error={amountError ?? undefined}
                required
              >
                <div className="input-prefix-wrap">
                  <span className="input-prefix" aria-hidden="true">
                    {t.currencyPrefix ?? '₹'}
                  </span>
                  <Input
                    id="credit-limit-input"
                    className={`input input-prefixed text-base font-semibold${amountError ? ' input-error-border' : ''}`}
                    type="number"
                    min="0"
                    step="100"
                    value={amountRupees}
                    onChange={(e) => {
                      setAmountRupees(e.target.value)
                      if (amountError) setAmountError(null)
                    }}
                    placeholder="50,000"
                    aria-invalid={Boolean(amountError)}
                    autoFocus
                  />
                </div>
              </FormField>
            </div>
          )}

          {/* Row 3: Action when limit is exceeded */}
          <div className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert size={15} className="text-[var(--color-primary-600)]" />
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {t.whenLimitExceeded ?? 'When limit exceeded'}
              </label>
            </div>

            <div className="pill-tabs" role="group" aria-label={t.whenLimitExceeded ?? 'When limit exceeded'}>
              <Button
                variant="none"
                type="button"
                className={`pill-tab${mode === 'WARN' ? ' active' : ''}`}
                onClick={() => setMode('WARN')}
              >
                {t.warn ?? 'Warn'}
              </Button>
              <Button
                variant="none"
                type="button"
                className={`pill-tab${mode === 'BLOCK' ? ' active' : ''}`}
                onClick={() => setMode('BLOCK')}
              >
                {t.blockLabel ?? 'Block'}
              </Button>
            </div>

            <Text className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
              {mode === 'WARN'
                ? 'Alerts the cashier with a warning banner but allows completing the invoice.'
                : 'Strictly prevents creating or saving new sales invoices.'}
            </Text>
          </div>
        </div>
      </form>
    </Drawer>
  )
}
