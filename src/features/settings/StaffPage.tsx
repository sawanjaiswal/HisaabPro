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
import { FALLBACK_BUSINESS_ID } from '@/config/app.config'
import { useAuth } from '@/context/AuthContext'
import { useStaff } from './useStaff'
import { StaffCard } from './components/StaffCard'
import { InviteCard } from './components/InviteCard'
import './staff-list.css'
import './staff-invite.css'

export default function StaffPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const businessId = user?.businessId ?? FALLBACK_BUSINESS_ID
  const { data, status, roles, refresh, handleSuspend, handleRemove, handleResendInvite, handleChangeRole } = useStaff(businessId)
  const [roleTarget, setRoleTarget] = useState<{ staffId: string; staffName: string; currentRoleId: string } | null>(null)

  const inviteAction = (
    <button
      type="button"
      className="staff-action-button"
      onClick={() => navigate(ROUTES.SETTINGS_STAFF_INVITE)}
      aria-label="Invite staff member"
      style={{ minWidth: 44, minHeight: 44 }}
    >
      <UserPlus size={20} aria-hidden="true" />
    </button>
  )

  return (
    <AppShell>
      <Header title="Staff" backTo={ROUTES.SETTINGS} actions={inviteAction} />
      <PageContainer className="staff-page">

        {status === 'loading' && (
          <div className="staff-list" aria-busy="true" aria-label="Loading staff">
            {[1, 2, 3].map((n) => (
              <div key={n} className="staff-card" style={{ height: 72, opacity: 0.4, background: 'var(--color-gray-100)' }} />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title="Could not load staff"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && data !== null && (
          <>
            {data.staff.length === 0 && data.pending.length === 0 ? (
              <EmptyState
                icon={<Users size={48} aria-hidden="true" />}
                title="No staff members"
                description="Invite your first team member to get started."
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-md"
                    onClick={() => navigate(ROUTES.SETTINGS_STAFF_INVITE)}
                    aria-label="Invite staff"
                  >
                    Invite Staff
                  </button>
                }
              />
            ) : (
              <>
                <section>
                  <p className="settings-section-title">Active Staff</p>
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
                    <p className="settings-section-title">Pending Invites</p>
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
          title={roleTarget ? `Change role for ${roleTarget.staffName}` : 'Change Role'}
          size="sm"
        >
          <div className="staff-role-picker" role="listbox" aria-label="Select a role">
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
                aria-label={`${role.name}${role.id === roleTarget?.currentRoleId ? ' (current)' : ''}`}
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
