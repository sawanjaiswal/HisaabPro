import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { InviteSuccessCard } from './components/InviteSuccessCard'
import { StaffInviteForm } from './components/StaffInviteForm'
import { useStaffInvite } from './useStaffInvite'
import './staff-list.css'
import './staff-invite.css'

export default function StaffInvitePage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const {
    name,
    phone,
    roleId,
    roles,
    errors,
    submitting,
    submitError,
    success,
    setName,
    setPhone,
    setRoleId,
    handleSubmit,
    handleShareWhatsApp,
  } = useStaffInvite()

  return (
    <AppShell>
      <Header title={t.inviteStaff} backTo={ROUTES.SETTINGS_STAFF} />
      <PageContainer className="staff-page stagger-enter">

        {success !== null ? (
          <InviteSuccessCard
            code={success.code}
            staffName={success.staffName}
            onShareWhatsApp={handleShareWhatsApp}
            onBackToStaff={() => navigate(ROUTES.SETTINGS_STAFF)}
          />
        ) : (
          <StaffInviteForm
            name={name}
            phone={phone}
            roleId={roleId}
            roles={roles}
            errors={errors}
            submitting={submitting}
            submitError={submitError}
            onNameChange={setName}
            onPhoneChange={setPhone}
            onRoleChange={setRoleId}
            onSubmit={handleSubmit}
          />
        )}

      </PageContainer>
    </AppShell>
  )
}
