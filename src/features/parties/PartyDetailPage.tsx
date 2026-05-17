/** Party Detail Page — shows full party info with tabs + quick actions */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Users } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
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
import { PartyAddressesTab } from './components/PartyAddressesTab'
import { PartyCrmTab } from './components/PartyCrmTab'
import { ShareLedgerSheet } from '@/features/shared-ledger/components/ShareLedgerSheet'
import { useShareLedger } from '@/features/shared-ledger/useShareLedger'
import { CommitmentsSection } from '@/features/collections/CommitmentsSection'
import { StatementPDFPreview } from '@/features/collections/StatementPDFPreview'
import { PartyLedgerTab } from './ledger/PartyLedgerTab'
import { PartyQuickActions } from './components/PartyQuickActions'
import { InviteDrawer } from '@/features/invite-claim/InviteDrawer'
import '@/features/shared-ledger/shared-ledger.css'
import './party-detail-header.css'

type DetailTab = 'overview' | 'transactions' | 'addresses' | 'ledger' | 'crm'

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: t.overview },
    { id: 'transactions', label: t.transactions },
    { id: 'addresses', label: t.addresses },
    { id: 'ledger', label: t.ledgerTab },
    { id: 'crm', label: t.crmDetailTabCrm },
  ]

  const partyId = id ?? ''
  const { party, status, activeTab, setActiveTab, refresh } = usePartyDetail(partyId)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [stmtOpen, setStmtOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const shareLedger = useShareLedger(partyId)

  const handleEdit = () => navigate(`/parties/${partyId}/edit`)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteParty(partyId)
      .then(() => {
        toast.success(t.partyMovedToTrash)
        navigate(ROUTES.PARTIES)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : t.failedDeleteParty
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
        aria-label={t.editParty}
      >
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setDeleteOpen(true)}
        aria-label={t.deleteParty}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </>
  )

  return (
    <>
      <AppShell>
        <Header title={t.partyDetails} backTo={ROUTES.PARTIES} actions={headerActions} />

        <PageContainer variant="detail" className="space-y-6">
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
              title={t.couldNotLoadParty}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          )}

          {status === 'success' && !party && (
            <EmptyState
              icon={<Users size={40} aria-hidden="true" />}
              title={t.partyNotFound}
              description={t.partyMayBeDeleted}
              action={
                <button
                  className="btn btn-primary btn-md"
                  onClick={() => navigate('/parties')}
                  aria-label={t.backToPartiesLabel}
                >
                  {t.backToParties}
                </button>
              }
            />
          )}

          {status === 'success' && party && (
            <div className="stagger-enter">
              <div role="status" aria-live="polite" className="sr-only">
                {party.name} {t.detailsLoaded}
              </div>
              <PartyDetailHeader party={party} />

              {/* Quick Actions — like MyBillBook */}
              <PartyQuickActions
                partyId={partyId}
                onStatement={() => setStmtOpen(true)}
                onShare={() => setShareOpen(true)}
                onInvite={() => setInviteOpen(true)}
                showInvite={party.userId == null}
              />

              {shareOpen && (
                <ShareLedgerSheet
                  partyName={party.name}
                  shares={shareLedger.shares}
                  isCreating={shareLedger.isCreating}
                  onCreate={shareLedger.createShare}
                  onRevoke={shareLedger.revokeShare}
                  onCopy={shareLedger.copyLink}
                  onClose={() => setShareOpen(false)}
                />
              )}
              {inviteOpen && (
                <InviteDrawer
                  partyId={partyId}
                  partyName={party.name}
                  partyPhone={party.phone}
                  onClose={() => setInviteOpen(false)}
                />
              )}
              {stmtOpen && (
                <StatementPDFPreview
                  open={stmtOpen}
                  onClose={() => setStmtOpen(false)}
                  partyId={partyId}
                  partyName={party.name}
                  partyPhone={party.phone}
                  businessName={party.companyName ?? party.name}
                />
              )}

              <div className="pill-tabs party-detail-tabs" role="tablist" aria-label={t.partyDetailSections}>
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

              <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${TABS.find(tab => tab.id === activeTab)?.label ?? activeTab} ${t.tabContent}`}>
                {activeTab === 'overview' && (
                  <>
                    <PartyOverviewTab party={party} />
                    <CommitmentsSection partyId={partyId} partyName={party.name} />
                  </>
                )}

                {activeTab === 'transactions' && (
                  <PartyTransactionsTab partyId={partyId} />
                )}

                {activeTab === 'addresses' && (
                  <PartyAddressesTab addresses={party.addresses} />
                )}

                {activeTab === 'ledger' && (
                  <PartyLedgerTab
                    partyId={partyId}
                    partyName={party.name}
                    businessName={party.companyName ?? party.name}
                  />
                )}

                {activeTab === 'crm' && (
                  <PartyCrmTab party={party} onPatched={refresh} />
                )}
              </div>
            </div>
          )}
        </PageContainer>
      </AppShell>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t.deletePartyConfirm}
        description={`"${party?.name ?? t.party}" ${t.deletePartyDesc}`}
        isLoading={isDeleting}
      />
    </>
  )
}
