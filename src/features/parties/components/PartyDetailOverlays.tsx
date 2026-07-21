/**
 * Party Detail — the three overlays the page can open (share ledger, portal
 * invite, statement preview).
 *
 * Extracted from `PartyDetailPage` purely for size: each is independently
 * mounted and unmounted, none of them shares state with the page body beyond
 * its own open flag, so grouping them costs nothing and keeps the page file
 * under the 250-line ratchet.
 */

import type { PartyDetail } from '../party.types'
import { ShareLedgerSheet } from '@/features/shared-ledger/components/ShareLedgerSheet'
import type { useShareLedger } from '@/features/shared-ledger/useShareLedger'
import { StatementPDFPreview } from '@/features/collections/StatementPDFPreview'
import { InviteDrawer } from '@/features/invite-claim/InviteDrawer'

interface PartyDetailOverlaysProps {
  party: PartyDetail
  partyId: string
  shareLedger: ReturnType<typeof useShareLedger>
  shareOpen: boolean
  onCloseShare: () => void
  inviteOpen: boolean
  onCloseInvite: () => void
  stmtOpen: boolean
  onCloseStatement: () => void
}

export function PartyDetailOverlays({
  party,
  partyId,
  shareLedger,
  shareOpen,
  onCloseShare,
  inviteOpen,
  onCloseInvite,
  stmtOpen,
  onCloseStatement,
}: PartyDetailOverlaysProps) {
  return (
    <>
      {shareOpen && (
        <ShareLedgerSheet
          partyName={party.name}
          shares={shareLedger.shares}
          isCreating={shareLedger.isCreating}
          onCreate={shareLedger.createShare}
          onRevoke={shareLedger.revokeShare}
          onCopy={shareLedger.copyLink}
          onClose={onCloseShare}
        />
      )}

      {inviteOpen && (
        <InviteDrawer
          partyId={partyId}
          partyName={party.name}
          partyPhone={party.phone}
          onClose={onCloseInvite}
        />
      )}

      {stmtOpen && (
        <StatementPDFPreview
          open={stmtOpen}
          onClose={onCloseStatement}
          partyId={partyId}
          partyName={party.name}
          partyPhone={party.phone}
          businessName={party.companyName ?? party.name}
        />
      )}
    </>
  )
}
