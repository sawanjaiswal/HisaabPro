import { useNavigate } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useStaff } from './useStaff'
import { StaffCard } from './components/StaffCard'
import { InviteCard } from './components/InviteCard'
import './settings.css'

// TODO: get from auth context
const BUSINESS_ID = 'business_1'

export default function StaffPage() {
  const navigate = useNavigate()
  const { data, status, refresh, handleSuspend, handleRemove, handleResendInvite } = useStaff(BUSINESS_ID)

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
                        onChangeRole={() => {/* role change handled per card */}}
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

      </PageContainer>
    </AppShell>
  )
}
