/** Party Detail — header ⋮ overflow menu (Edit / Invoice / Share / Invite / Delete) */

import { MoreVertical, Pencil, FileText, Share2, UserPlus, Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'

interface PartyDetailMenuProps {
  onEdit: () => void
  onInvoice: () => void
  onShare: () => void
  onInvite: () => void
  onDelete: () => void
  /** Invite shown only when the portal is not yet claimed */
  showInvite: boolean
}

export function PartyDetailMenu({
  onEdit,
  onInvoice,
  onShare,
  onInvite,
  onDelete,
  showInvite,
}: PartyDetailMenuProps) {
  const { t } = useLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t.partyDetailSections}>
          <MoreVertical size={18} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil size={16} aria-hidden="true" />
          <span>{t.editParty}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onInvoice}>
          <FileText size={16} aria-hidden="true" />
          <span>{t.createInvoiceLabel}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShare}>
          <Share2 size={16} aria-hidden="true" />
          <span>{t.shareLedgerLabel}</span>
        </DropdownMenuItem>
        {showInvite && (
          <DropdownMenuItem onSelect={onInvite}>
            <UserPlus size={16} aria-hidden="true" />
            <span>{t.inviteToPortalButton}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem danger onSelect={onDelete}>
          <Trash2 size={16} aria-hidden="true" />
          <span>{t.deleteParty}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
