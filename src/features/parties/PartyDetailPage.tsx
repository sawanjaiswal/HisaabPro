/** Party Detail Page — shows full party info with tabs + quick actions */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PartyDetailSkeleton } from './components/PartyDetailSkeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { useQueryClient } from '@tanstack/react-query'
import { usePartyDetail } from './usePartyDetail'
import { deleteParty } from './party.service'
import { reconcilePartyDeleted } from './party-cache'
import { PartyDetailHeader } from './components/PartyDetailHeader'
import { PartySummaryTiles } from './components/PartySummaryTiles'
import { PartyOverviewTab } from './components/PartyOverviewTab'
import { PartyAddressesTab } from './components/PartyAddressesTab'
import { PartyCrmTab } from './components/PartyCrmTab'
import { usePartyDetailTabs } from './usePartyDetailTabs'
import { ShareLedgerSheet } from '@/features/shared-ledger/components/ShareLedgerSheet'
import { useShareLedger } from '@/features/shared-ledger/useShareLedger'
import { CommitmentsSection } from '@/features/collections/CommitmentsSection'
import { StatementPDFPreview } from '@/features/collections/StatementPDFPreview'
import { PartyLedgerTab } from './ledger/PartyLedgerTab'
import { PartyDetailActionBar } from './components/PartyDetailActionBar'
import { InviteDrawer } from '@/features/invite-claim/InviteDrawer'
import '@/features/shared-ledger/shared-ledger.css'
import './party-detail-header.css'
import { Button } from '@/components/ui/Button'

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const { tabs: TABS } = usePartyDetailTabs()

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
        reconcilePartyDeleted(queryClient, partyId)
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

  return (
    <>
      <AppShell>
        {party ? (
          <PartyDetailHeader
            party={party}
            onBack={() => navigate(ROUTES.PARTIES)}
            onEdit={handleEdit}
            onInvoice={() => navigate(`/invoices/new?partyId=${partyId}`)}
            onShare={() => setShareOpen(true)}
            onInvite={() => setInviteOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            showInvite={party.userId == null}
          />
        ) : (
          <Header variant="emerald" title={t.partyDetails} backTo={ROUTES.PARTIES} />
        )}

        <PageContainer variant="detail" className="space-y-6">
          {status === 'loading' && <PartyDetailSkeleton />}

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
                <Button
                  variant="primary" size="md"
                  onClick={() => navigate('/parties')}
                  aria-label={t.backToPartiesLabel}
                >
                  {t.backToParties}
                </Button>
              }
            />
          )}

          {status === 'success' && party && (
            <div className="stagger-enter space-y-4">
              <div role="status" aria-live="polite" className="sr-only">
                {party.name} {t.detailsLoaded}
              </div>
              {/* Summary tiles (Outstanding / Sales MTD / Last Payment) — mockup */}
              <PartySummaryTiles party={party} />

              {/* Primary actions — Receive Payment + WhatsApp Statement */}
              <PartyDetailActionBar
                partyId={partyId}
                onStatement={() => setStmtOpen(true)}
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

              <div className="party-detail-tabs" role="tablist" aria-label={t.partyDetailSections}>
                {TABS.map((tab) => (
                  <Button variant="none"
                    key={tab.id}
                    role="tab"
                    className={`party-detail-tab${activeTab === tab.id ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    aria-selected={activeTab === tab.id}
                    aria-controls={`panel-${tab.id}`}
                  >
                    <tab.icon size={16} aria-hidden="true" />
                    {tab.label}
                  </Button>
                ))}
              </div>

              <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${TABS.find(tab => tab.id === activeTab)?.label ?? activeTab} ${t.tabContent}`}>
                {activeTab === 'ledger' && (
                  <PartyLedgerTab
                    partyId={partyId}
                    partyName={party.name}
                    businessName={party.companyName ?? party.name}
                  />
                )}

                {activeTab === 'invoices' && (
                  <PartyLedgerTab
                    partyId={partyId}
                    partyName={party.name}
                    businessName={party.companyName ?? party.name}
                    lockTypes={['SALE']}
                  />
                )}

                {activeTab === 'payments' && (
                  <PartyLedgerTab
                    partyId={partyId}
                    partyName={party.name}
                    businessName={party.companyName ?? party.name}
                    lockTypes={['PAYMENT']}
                  />
                )}

                {activeTab === 'info' && (
                  <>
                    <PartyOverviewTab party={party} />
                    <PartyAddressesTab addresses={party.addresses} />
                    <PartyCrmTab party={party} onPatched={refresh} />
                    <CommitmentsSection partyId={partyId} partyName={party.name} />
                  </>
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
