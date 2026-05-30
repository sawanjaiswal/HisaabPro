/** POS — Optional walk-in name/phone form */

import { useState, useCallback } from 'react'
import { User, Phone } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'

interface WalkInFormProps {
  name?:      string
  phone?:     string
  onChange:   (name: string, phone: string) => void
}

export function WalkInForm({ name = '', phone = '', onChange }: WalkInFormProps) {
  const { t } = useLanguage()
  const [localName,  setLocalName]  = useState(name)
  const [localPhone, setLocalPhone] = useState(phone)

  const handleName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.slice(0, 60)
    setLocalName(v)
    onChange(v, localPhone)
  }, [localPhone, onChange])

  const handlePhone = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 15)
    setLocalPhone(v)
    onChange(localName, v)
  }, [localName, onChange])

  return (
    <div className="pos-walkin-form">
      <p className="pos-walkin-form__label">{t.posWalkInOptional ?? 'Walk-in details (optional)'}</p>
      <div className="pos-walkin-form__fields">
        <div className="pos-field">
          <User size={14} className="pos-field__icon" aria-hidden="true" />
          <Input
            type="text"
            className="pos-field__input"
            placeholder={t.posWalkInName ?? 'Customer name'}
            value={localName}
            onChange={handleName}
            aria-label={t.posWalkInName ?? 'Customer name'}
            maxLength={60}
          />
        </div>
        <div className="pos-field">
          <Phone size={14} className="pos-field__icon" aria-hidden="true" />
          <Input
            type="tel"
            inputMode="numeric"
            className="pos-field__input"
            placeholder={t.posWalkInPhone ?? 'Phone number'}
            value={localPhone}
            onChange={handlePhone}
            aria-label={t.posWalkInPhone ?? 'Phone number'}
            maxLength={15}
          />
        </div>
      </div>
    </div>
  )
}
