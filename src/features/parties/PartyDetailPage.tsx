/** Party Detail Page — shows full party info with tabs + quick actions */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { useFlowEngine } from '@/lib/navigation'
import { usePartyDetail } from './usePartyDetail'
import { deleteParty } from './party.service'
import { reconcilePartyDeleted } from './party-cache'
import { PartyDetailHeader } from './components/PartyDetailHeader'
import { PartyFinancialSummary } from './components/PartyFinancialSummary'
import { PartyOverviewTab } from './components/PartyOverviewTab'
import { PartyAddressesTab } from './components/PartyAddressesTab'
import { PartyCrmTab } from './components/PartyCrmTab'
import { usePartyDetailTabs } from './usePartyDetailTabs'
import { useShareLedger } from '@/features/shared-ledger/useShareLedger'
import { CommitmentsSection } from '@/features/collections/CommitmentsSection'
import { PartyDetailOverlays } from './components/PartyDetailOverlays'
import { PartyLedgerTab } from './ledger/PartyLedgerTab'
import { PartyOverdueAlert } from './components/PartyOverdueAlert'
import { PartyDetailPayBar } from './components/PartyDetailPayBar'
import '@/features/shared-ledger/shared-ledger.css'
import './party-detail-header.css'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import type { PartyDetailTab } from './usePartyDetailTabs'

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { goBack, completeFlow, navigateWithContext } = useFlowEngine()
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

  const handleEdit = () => navigateWithContext(`/parties/${partyId}/edit`)
  const handleReceivePayment = () => navigateWithContext(`/payments/new?partyId=${partyId}`)
  const handleNewInvoice = () => navigateWithContext(`/invoices/new?partyId=${partyId}`)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteParty(partyId)
      .then(() => {
        reconcilePartyDeleted(queryClient, partyId)
        toast.success(t.partyMovedToTrash)
        completeFlow({ terminalPath: ROUTES.PARTIES })
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
            onBack={() => goBack({ fallbackRoute: ROUTES.PARTIES })}
            onEdit={handleEdit}
            onInvoice={() => navigateWithContext(`/invoices/new?partyId=${partyId}`)}
            onShare={() => setShareOpen(true)}
            onInvite={() => setInviteOpen(true)}
            onStatement={() => setStmtOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            showInvite={party.userId == null}
          />
        ) : (
          <Header variant="emerald" title={t.partyDetails} backTo={ROUTES.PARTIES} />
        )}

        {/* Emerald field the white sheet curves over — mirrors HeroPage's
            hp-hero-top so the detail page reads like every other page. */}
        <div className="pd-hero-field" aria-hidden="true" />

        <PageContainer variant="detail" className="pd-detail-sheet space-y-6">
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
                  onClick={() => goBack({ fallbackRoute: ROUTES.PARTIES })}
                  aria-label={t.backToPartiesLabel}
                >
                  {t.backToParties}
                </Button>
              }
            />
          )}

          {status === 'success' && party && (
            <div className="stagger-enter space-y-4 flex-1 flex flex-col min-h-0">
              <div role="status" aria-live="polite" className="sr-only">
                {party.name} {t.detailsLoaded}
              </div>
              {/* Stat strip — Outstanding / Oldest Due / Open Invoices / Last Payment */}
              <PartyFinancialSummary party={party} />

              {/* Advisory: hides itself when nothing is overdue */}
              {party.stats?.oldestOverdueInvoice && (
                <PartyOverdueAlert
                  invoiceNumber={party.stats.oldestOverdueInvoice.number}
                  amountPaise={party.stats.oldestOverdueInvoice.amountPaise}
                  daysOverdue={party.stats.oldestOverdueInvoice.daysOverdue}
                  onReceivePayment={handleReceivePayment}
                />
              )}

              {/* Primary actions now live in the sticky pay bar; overflow
                  actions (edit/share/statement/invite/delete) in the header ⋮ */}
              <PartyDetailOverlays
                party={party}
                partyId={partyId}
                shareLedger={shareLedger}
                shareOpen={shareOpen}
                onCloseShare={() => setShareOpen(false)}
                inviteOpen={inviteOpen}
                onCloseInvite={() => setInviteOpen(false)}
                stmtOpen={stmtOpen}
                onCloseStatement={() => setStmtOpen(false)}
              />

              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as PartyDetailTab)}
                className="flex-1 flex flex-col min-h-0"
              >
                <TabsList variant="line" aria-label={t.partyDetailSections}>
                  {TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      icon={<tab.icon size={15} />}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="ledger" className="flex-1 flex flex-col min-h-0">
                  <PartyLedgerTab
                    partyId={partyId}
                    partyName={party.name}
                    businessName={party.companyName ?? party.name}
                  />
                </TabsContent>

                <TabsContent value="invoices" className="flex-1 flex flex-col min-h-0">
                  <PartyLedgerTab
                    partyId={partyId}
                    partyName={party.name}
                    businessName={party.companyName ?? party.name}
                    lockTypes={['SALE']}
                  />
                </TabsContent>

                <TabsContent value="payments" className="flex-1 flex flex-col min-h-0">
                  <PartyLedgerTab
                    partyId={partyId}
                    partyName={party.name}
                    businessName={party.companyName ?? party.name}
                    lockTypes={['PAYMENT']}
                  />
                </TabsContent>

                <TabsContent value="info" className="flex-1 flex flex-col min-h-0">
                  <div className="space-y-4">
                    <PartyOverviewTab party={party} />
                    <PartyAddressesTab addresses={party.addresses} />
                    <PartyCrmTab party={party} onPatched={refresh} />
                    <CommitmentsSection partyId={partyId} partyName={party.name} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </PageContainer>

        {status === 'success' && party && (
          <PartyDetailPayBar
            outstandingPaise={party.outstandingBalance}
            isSupplier={party.type === 'SUPPLIER'}
            onReceivePayment={handleReceivePayment}
            onNewInvoice={handleNewInvoice}
          />
        )}
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
