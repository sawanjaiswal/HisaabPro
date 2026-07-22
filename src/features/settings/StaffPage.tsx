import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users, Check } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
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
    <Button variant="none"
      type="button"
      className="staff-action-button"
      onClick={() => navigate(ROUTES.SETTINGS_STAFF_INVITE)}
      aria-label={t.inviteStaffMember}
      style={{ minWidth: 44, minHeight: 44 }}
    >
      <UserPlus size={20} aria-hidden="true" />
    </Button>
  )

  return (
    <AppShell>
      <Header title={t.staff} backTo={ROUTES.SETTINGS} actions={inviteAction} />
      <HeroPage className="staff-page space-y-6">

        {status === 'loading' && (
          <div className="staff-list" aria-busy="true" aria-label={t.loadingStaffLabel}>
            <Skeleton height="72px" borderRadius="var(--radius-xl)" count={3} />
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
                  <Button
                    type="button"
                    variant="primary" size="md"
                    onClick={() => navigate(ROUTES.SETTINGS_STAFF_INVITE)}
                    aria-label={t.inviteStaffBtn}
                  >
                    {t.inviteStaffBtn}
                  </Button>
                }
              />
            ) : (
              <>
                <section>
                  <p className="settings-section-title py-0">{t.activeStaffTitle}</p>
                  <div className="staff-list stagger-list">
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
                    <p className="settings-section-title py-0">{t.pendingInvitesTitle}</p>
                    <div className="staff-list stagger-list">
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
              <Button variant="none"
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
              </Button>
            ))}
          </div>
        </Drawer>

      </HeroPage>
    </AppShell>
  )
}
