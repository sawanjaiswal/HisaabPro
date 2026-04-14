import { useState } from 'react'
import { SEO } from '../../components/layout/SEO'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { APP_NAME } from '../../config/app.config'
import { useLanguage } from '../../context/LanguageContext'
import { BUSINESS_TYPES } from './onboarding.constants'
import { useOnboarding } from './useOnboarding'
import './onboarding.css'

type Step = 'welcome' | 'setup'

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'GST Invoices',
    desc: 'Create professional invoices & share on WhatsApp instantly',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Party Ledger',
    desc: 'Track credit/debit for every customer and supplier',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Payments & Dues',
    desc: 'Record payments, track outstanding, send reminders',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: 'P&L Reports',
    desc: 'Profit & loss, balance sheet, cash flow at a glance',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome')
  const {
    businessName, setBusinessName,
    businessType, setBusinessType,
    phone, setPhone,
    loading, error,
    handleSubmit,
  } = useOnboarding()
  const { t } = useLanguage()

  if (step === 'welcome') {
    return (
      <div className="onboarding-page">
        <SEO title={`Welcome to ${APP_NAME}`} />
        <div className="onboarding-card stagger-enter" style={{ maxWidth: 420 }}>
          <div className="onboarding-icon" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary-50)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, color: 'var(--color-primary-500)' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>

          <div className="onboarding-header">
            <h1 className="onboarding-title">Welcome to {APP_NAME}</h1>
            <p className="onboarding-subtitle">Set up your business in 60 seconds and start managing everything from one place</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: 'var(--color-primary-50)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  color: 'var(--color-primary-600)',
                }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--color-gray-800)', marginBottom: 2 }}>{f.title}</p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-gray-500)', lineHeight: 1.4 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="onboarding-submit"
            onClick={() => setStep('setup')}
          >
            Get Started
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding-page">
      <SEO title={t.onboardingTitle} />

      <div className="onboarding-card stagger-enter">
        <div className="onboarding-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>

        <div className="onboarding-header">
          <h1 className="onboarding-title">{t.onboardingTitle}</h1>
          <p className="onboarding-subtitle">
            {t.onboardingSubtitle.replace('{appName}', APP_NAME)}
          </p>
        </div>

        <form
          className="onboarding-form"
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          noValidate
        >
          <Input
            id="businessName"
            label={t.onboardingBusinessName}
            type="text"
            placeholder={t.onboardingBusinessNamePh}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={loading}
            autoFocus
            autoComplete="organization"
            maxLength={100}
            required
          />

          <div className="input-group">
            <label htmlFor="businessType" className="input-label">
              {t.onboardingBusinessType}
            </label>
            <select
              id="businessType"
              className="input onboarding-select"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={loading}
              aria-label={t.onboardingBusinessType}
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t[type.labelKey]}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="phone"
            label={t.onboardingPhone}
            type="tel"
            placeholder={t.onboardingPhonePh}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            autoComplete="tel"
            maxLength={10}
            inputMode="numeric"
          />

          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={!businessName.trim()}
            className="onboarding-submit"
            aria-label={loading ? t.onboardingSubmitting : t.onboardingSubmitAria}
          >
            {loading ? t.onboardingSubmitting : t.onboardingSubmit}
          </Button>

          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--color-gray-500)', fontSize: 'var(--fs-sm)', cursor: 'pointer', textAlign: 'center', padding: 'var(--space-1)' }}
            onClick={() => setStep('welcome')}
          >
            Back
          </button>
        </form>
      </div>
    </div>
  )
}
