/** Party Detail Page — shows full party info with tabs */

import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, MoreVertical, MapPin, Receipt, Users } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { usePartyDetail } from './usePartyDetail'
import { PartyDetailHeader } from './components/PartyDetailHeader'
import { PartyOverviewTab } from './components/PartyOverviewTab'
import './party-detail.css'

type DetailTab = 'overview' | 'transactions' | 'addresses'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'addresses', label: 'Addresses' },
]

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // id is guaranteed by the route — fall back to empty string to avoid
  // conditional hook call (route guard ensures id is always present)
  const partyId = id ?? ''
  const { party, status, activeTab, setActiveTab, refresh } = usePartyDetail(partyId)

  const handleEdit = () => navigate(`/parties/${partyId}/edit`)

  const headerActions = (
    <>
      <button
        className="btn btn-ghost btn-sm"
        onClick={handleEdit}
        aria-label="Edit party"
      >
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        aria-label="More options"
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
    </>
  )

  return (
    <AppShell>
      <Header title="Party Detail" backTo={ROUTES.PARTIES} actions={headerActions} />

      <PageContainer>
        {status === 'loading' && (
          <>
            <div className="card-primary" style={{ marginBottom: 'var(--space-4)', minHeight: 140 }}>
              <Skeleton height="1.5rem" width="60%" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Skeleton height="1rem" width="40%" />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Skeleton height="2.5rem" width="50%" />
              </div>
            </div>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
            </div>
          </>
        )}

        {status === 'error' && (
          <ErrorState
            title="Could not load party"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && !party && (
          <EmptyState
            icon={<Users size={40} aria-hidden="true" />}
            title="Party not found"
            description="This party may have been deleted."
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate('/parties')}
                aria-label="Go back to parties list"
              >
                Back to Parties
              </button>
            }
          />
        )}

        {status === 'success' && party && (
          <>
            <PartyDetailHeader party={party} />

            <div className="pill-tabs party-detail-tabs" role="tablist" aria-label="Party detail sections">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} tab content`}>
              {activeTab === 'overview' && <PartyOverviewTab party={party} />}

              {activeTab === 'transactions' && (
                <EmptyState
                  icon={<Receipt size={40} aria-hidden="true" />}
                  title="No transactions yet"
                  description="Create an invoice to start tracking business with this party."
                  action={
                    <button
                      className="btn btn-primary btn-md"
                      onClick={() => navigate('/invoices/new')}
                      aria-label="Create invoice for this party"
                    >
                      Create Invoice
                    </button>
                  }
                />
              )}

              {activeTab === 'addresses' && (
                <>
                  {party.addresses.length === 0 ? (
                    <EmptyState
                      icon={<MapPin size={40} aria-hidden="true" />}
                      title="No addresses added"
                      description="Add billing or shipping addresses for this party."
                    />
                  ) : (
                    <div className="party-info-card">
                      {party.addresses.map((address) => (
                        <div key={address.id} className="card">
                          <div className="party-address-card">
                            <div className="party-address-label">
                              <MapPin size={14} aria-hidden="true" />
                              {address.label} — {address.type}
                              {address.isDefault && (
                                <span className="badge badge-info" style={{ marginLeft: 'var(--space-2)' }}>
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="party-address-line">
                              {address.line1}
                              {address.line2 && `, ${address.line2}`}
                              <br />
                              {address.city}, {address.state} — {address.pincode}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
