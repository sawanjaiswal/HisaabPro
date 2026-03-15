import { Phone } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { PHONE_MAX_LENGTH, PHONE_REGEX } from '../auth.constants'

interface PhoneStepProps {
  phone: string
  onPhoneChange: (value: string) => void
  onSubmit: () => void
  loading: boolean
  error: string
}

export function PhoneStep({ phone, onPhoneChange, onSubmit, loading, error }: PhoneStepProps) {
  const isValid = PHONE_REGEX.test(phone)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH)
    onPhoneChange(value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid && !loading) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-form__field">
        <Input
          type="tel"
          label="Phone Number"
          placeholder="Enter 10-digit mobile number"
          value={phone}
          onChange={handleChange}
          disabled={loading}
          autoComplete="tel"
          inputMode="numeric"
          icon={<Phone size={18} />}
          error={error}
          aria-label="Phone number"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={!isValid}
        className="auth-form__submit"
      >
        Send OTP
      </Button>
    </form>
  )
}
