/** PriceListFormDrawer — create / rename a price list + isDefault toggle */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import type { PriceList, PriceListFormData } from '../price-list.types'
import { Input } from '@/components/ui/Input'

interface PriceListFormDrawerProps {
  open: boolean
  initial?: PriceList | null
  isLoading: boolean
  onClose: () => void
  onSubmit: (data: PriceListFormData) => void
}

export function PriceListFormDrawer({
  open,
  initial,
  isLoading,
  onClose,
  onSubmit,
}: PriceListFormDrawerProps) {
  const { t } = useLanguage()
  const isEdit = !!initial

  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setIsDefault(initial?.isDefault ?? false)
      setError('')
    }
  }, [open, initial])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t.plNameRequired)
      return
    }
    onSubmit({ name: trimmed, isDefault })
  }

  const title = isEdit ? t.plEditTitle : t.plCreateTitle

  const footer = (
    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
      <Button variant="none" type="button" className="btn btn-outline flex-1" onClick={onClose}>
        {t.cancel}
      </Button>
      <Button
        type="submit"
        form="pl-form"
        variant="primary" className="flex-1"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? t.saving : t.save}
      </Button>
    </div>
  )

  return (
    <Drawer open={open} onClose={onClose} title={title} footer={footer}>
      <form id="pl-form" className="pl-form" onSubmit={handleSubmit} noValidate>
        <div className="pl-form__field">
          <label htmlFor="pl-name" className="pl-form__label">{t.plNameLabel}</label>
          <Input
            id="pl-name"
            type="text"
            className={`input${error ? ' input--error' : ''}`}
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder={t.plNamePlaceholder}
            maxLength={80}
            autoFocus
            aria-describedby={error ? 'pl-name-error' : undefined}
            aria-invalid={!!error}
          />
          {error && (
            <span id="pl-name-error" className="input__error" role="alert">{error}</span>
          )}
        </div>

        <div className="pl-form__toggle-row">
          <div>
            <p className="pl-form__toggle-label">{t.plSetDefault}</p>
            <p className="pl-form__toggle-desc">{t.plSetDefaultDesc}</p>
          </div>
          <label className="pl-toggle" aria-label={t.plSetDefault}>
            <Input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <span className="pl-toggle__track" />
          </label>
        </div>
      </form>
    </Drawer>
  )
}
