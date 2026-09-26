import { Text } from '@/components/ui/Text'
import { useEffect, useRef } from 'react'
import { Building2, CheckCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { ROUTES } from '@/config/routes.config'
import { useJoinBusiness } from './useJoinBusiness'
import './join-business.css'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Heading } from '@/components/ui/Heading'

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
            <Heading level={2} className="join-business-success-title">
              {t.youJoinedBusiness.replace('{name}', success.businessName)}
            </Heading>
            <Text className="join-business-success-subtitle">
              {t.roleColon2} {success.roleName}
            </Text>
            <Button variant="none"
              type="button"
              className="join-business-btn"
              onClick={handleGoToDashboard}
            >
              {t.goToDashboard}
            </Button>
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
        <Heading level={2} className="join-business-heading">{t.enterInviteCodeHeading}</Heading>
        <Text className="join-business-subtitle">
          {t.inviteCodeSubtitle}
        </Text>

        <Input
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

        {error && <Text className="join-business-error">{error}</Text>}

        <Button variant="none"
          type="button"
          className="join-business-btn"
          disabled={code.length !== 6 || loading}
          onClick={handleSubmit}
        >
          {loading ? t.joiningText : t.joinBusinessBtn}
        </Button>
      </div>
    </div>
  )
}
