import { useEffect, useRef } from 'react'
import { Building2, CheckCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { ROUTES } from '@/config/routes.config'
import { useJoinBusiness } from './useJoinBusiness'
import './join-business.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function JoinBusinessPage() {
  const { t } = useLanguage()
  const { code, loading, error, success, handleCodeChange, handleSubmit } = useJoinBusiness()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleGoToDashboard = () => {
    window.location.href = ROUTES.DASHBOARD
  }

  if (success) {
    return (
      <div className="join-business-page space-y-6">
        <Header title={t.joinBusiness} backTo={ROUTES.SETTINGS} />
        <div className="join-business-content">
          <div className="join-business-success">
            <CheckCircle size={48} className="join-business-success-icon" />
            <h2 className="join-business-success-title">
              {t.youJoinedBusiness.replace('{name}', success.businessName)}
            </h2>
            <p className="join-business-success-subtitle">
              {t.roleColon2} {success.roleName}
            </p>
            <button
              type="button"
              className="join-business-btn"
              onClick={handleGoToDashboard}
            >
              {t.goToDashboard}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="join-business-page space-y-6">
      <Header title={t.joinBusiness} backTo={ROUTES.SETTINGS} />
      <div className="join-business-content stagger-enter">
        <div className="join-business-icon-container space-y-6">
          <Building2 size={40} className="join-business-icon" />
        </div>
        <h2 className="join-business-heading">{t.enterInviteCodeHeading}</h2>
        <p className="join-business-subtitle">
          {t.inviteCodeSubtitle}
        </p>

        <input
          ref={inputRef}
          type="text"
          className="join-business-input"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder={t.inviteCodePlaceholder}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={t.inviteCodeAria}
        />

        {error && <p className="join-business-error">{error}</p>}

        <button
          type="button"
          className="join-business-btn"
          disabled={code.length !== 6 || loading}
          onClick={handleSubmit}
        >
          {loading ? t.joiningText : t.joinBusinessBtn}
        </button>
      </div>
    </div>
  )
}
