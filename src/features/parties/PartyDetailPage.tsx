/** Party Detail Page — shows full party info with tabs + quick actions */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, MapPin, Users, FileText, Wallet, MessageSquare } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { usePartyDetail } from './usePartyDetail'
import { deleteParty } from './party.service'
import { PartyDetailHeader } from './components/PartyDetailHeader'
import { PartyOverviewTab } from './components/PartyOverviewTab'
import { PartyTransactionsTab } from './components/PartyTransactionsTab'
import './party-detail-header.css'

type DetailTab = 'overview' | 'transactions' | 'addresses'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'addresses', label: 'Addresses' },
]

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const partyId = id ?? ''
  const { party, status, activeTab, setActiveTab, refresh } = usePartyDetail(partyId)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleEdit = () => navigate(`/parties/${partyId}/edit`)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteParty(partyId)
      .then(() => {
        toast.success('Party moved to trash')
        navigate(ROUTES.PARTIES)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to delete party'
        toast.error(message)
        setIsDeleting(false)
        setDeleteOpen(false)
      })
  }

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
        onClick={() => setDeleteOpen(true)}
        aria-label="Delete party"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </>
  )

  return (
    <>
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
              <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                {party.name} details loaded
              </div>
              <PartyDetailHeader party={party} />

              {/* Quick Actions — like MyBillBook */}
              <div className="party-quick-actions" role="group" aria-label="Quick actions">
                <button
                  className="party-quick-action-btn"
                  onClick={() => navigate(`/invoices/new?partyId=${partyId}`)}
                  aria-label="Create invoice"
                >
                  <FileText size={18} aria-hidden="true" />
                  <span>Invoice</span>
                </button>
                <button
                  className="party-quick-action-btn"
                  onClick={() => navigate(`/payments/new?partyId=${partyId}`)}
                  aria-label="Record payment"
                >
                  <Wallet size={18} aria-hidden="true" />
                  <span>Payment</span>
                </button>
                <button
                  className="party-quick-action-btn"
                  onClick={() => navigate(`/reports/party-statement/${partyId}`)}
                  aria-label="View statement"
                >
                  <MessageSquare size={18} aria-hidden="true" />
                  <span>Statement</span>
                </button>
              </div>

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
                  <PartyTransactionsTab partyId={partyId} />
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

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Party?"
        description={`"${party?.name ?? 'This party'}" and all associated data will be moved to trash. This can be undone within 30 days.`}
        isLoading={isDeleting}
      />
    </>
  )
}
