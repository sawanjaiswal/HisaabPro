import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users, Check } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Drawer } from '@/components/ui/Drawer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/context/AuthContext'
import { useStaff } from './useStaff'
import { StaffCard } from './components/StaffCard'
import { InviteCard } from './components/InviteCard'
import './staff-list.css'
import './staff-invite.css'

export default function StaffPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { data, status, roles, refresh, handleSuspend, handleRemove, handleResendInvite, handleChangeRole } = useStaff(businessId)
  const [roleTarget, setRoleTarget] = useState<{ staffId: string; staffName: string; currentRoleId: string } | null>(null)

  const inviteAction = (
    <button
      type="button"
      className="staff-action-button"
      onClick={() => navigate(ROUTES.SETTINGS_STAFF_INVITE)}
      aria-label={t.inviteStaffMember}
      style={{ minWidth: 44, minHeight: 44 }}
    >
      <UserPlus size={20} aria-hidden="true" />
    </button>
  )

  return (
    <AppShell>
      <Header title={t.staff} backTo={ROUTES.SETTINGS} actions={inviteAction} />
      <PageContainer className="staff-page">

        {status === 'loading' && (
          <div className="staff-list" aria-busy="true" aria-label={t.loadingStaffLabel}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="staff-card" style={{ height: 72, opacity: 0.4, background: 'var(--color-gray-100)' }} />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadStaff}
            message={t.checkConnectionRetry2}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data !== null && (
          <>
            {data.staff.length === 0 && data.pending.length === 0 ? (
              <EmptyState
                icon={<Users size={48} aria-hidden="true" />}
                title={t.noStaffMembers}
                description={t.inviteFirstTeamMember}
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-md"
                    onClick={() => navigate(ROUTES.SETTINGS_STAFF_INVITE)}
                    aria-label={t.inviteStaffBtn}
                  >
                    {t.inviteStaffBtn}
                  </button>
                }
              />
            ) : (
              <>
                <section>
                  <p className="settings-section-title">{t.activeStaffTitle}</p>
                  <div className="staff-list">
                    {data.staff.map((member) => (
                      <StaffCard
                        key={member.id}
                        staff={member}
                        onSuspend={(id) => handleSuspend(id, member.name)}
                        onRemove={(id) => handleRemove(id, member.name)}
                        onChangeRole={() => setRoleTarget({ staffId: member.id, staffName: member.name, currentRoleId: member.role.id })}
                      />
                    ))}
                  </div>
                </section>

                {data.pending.length > 0 && (
                  <section>
                    <p className="settings-section-title">{t.pendingInvitesTitle}</p>
                    <div className="staff-list">
                      {data.pending.map((invite) => (
                        <InviteCard
                          key={invite.id}
                          invite={invite}
                          onResend={handleResendInvite}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* Role change drawer */}
        <Drawer
          open={roleTarget !== null}
          onClose={() => setRoleTarget(null)}
          title={roleTarget ? `${t.changeRoleFor} ${roleTarget.staffName}` : t.changeRoleTitle}
          size="sm"
        >
          <div className="staff-role-picker" role="listbox" aria-label={t.selectARole}>
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`staff-role-option${role.id === roleTarget?.currentRoleId ? ' staff-role-option--active' : ''}`}
                onClick={() => {
                  if (roleTarget && role.id !== roleTarget.currentRoleId) {
                    handleChangeRole(roleTarget.staffId, roleTarget.staffName, role.id)
                  }
                  setRoleTarget(null)
                }}
                role="option"
                aria-selected={role.id === roleTarget?.currentRoleId}
                aria-label={`${role.name}${role.id === roleTarget?.currentRoleId ? ` (${t.currentRoleLabel})` : ''}`}
              >
                <span className="staff-role-option-info">
                  <span className="staff-role-option-name">{role.name}</span>
                  {role.description && <span className="staff-role-option-desc">{role.description}</span>}
                </span>
                {role.id === roleTarget?.currentRoleId && (
                  <Check size={18} className="staff-role-option-check" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </Drawer>

      </PageContainer>
    </AppShell>
  )
}
