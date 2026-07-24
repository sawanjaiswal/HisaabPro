import { Link } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { APP_NAME } from '../../config/app.config'
import { useRegister } from './useRegister'
import { useLanguage } from '@/context/LanguageContext'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const phoneRegex = /^[6-9]\d{9}$/

export default function RegisterPage() {
  const { t } = useLanguage()
  const {
    name, setName,
    phone, setPhone,
    password, setPassword,
    loading, error,
    handleRegister,
  } = useRegister()

  const isValid = name.trim().length > 0 && phoneRegex.test(phone) && password.length >= 6

  return (
    <div className="login-page">
      <SEO title={t.createAccount} />

      <div className="login-page__card stagger-enter">
        <div className="login-page__header">
          <h1 className="login-page__title">{APP_NAME}</h1>
          <p className="login-page__subtitle">{t.createFreeAccount}</p>
        </div>

        <form
          className="login-page__form"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValid && !loading) handleRegister()
          }}
        >
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="name">{t.fullName}</label>
            <div className="login-page__input-wrapper">
              <Input
                id="name"
                type="text"
                className="login-page__input"
                placeholder={t.yourNameHint}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </div>
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor="phone">{t.mobileNumber}</label>
            <div className="login-page__input-wrapper">
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                className="login-page__input"
                placeholder={t.mobileNumberHint}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor="password">{t.password}</label>
            <div className="login-page__input-wrapper">
              <Input
                id="password"
                type="password"
                className="login-page__input"
                placeholder={t.min6CharsHint}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <p className="login-page__error">{error}</p>}

          <Button variant="none"
            type="submit"
            className="login-page__submit"
            disabled={!isValid || loading}
          >
            {loading ? t.sendingOtp : t.continueWith}
          </Button>

          <p className="login-page__hint">
            {t.alreadyHaveAccount}{' '}
            <Link to={ROUTES.LOGIN} className="login-page__link">
              {t.signIn}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
