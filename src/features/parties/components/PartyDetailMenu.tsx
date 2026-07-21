/** Party Detail — overflow menu (Edit / Invoice / Share / Statement / Invite / Delete).
 *
 * Mounted twice on the detail page with the same items and two triggers: the
 * hero's ⋮ and the action row's ⋯. Only the trigger differs, so `appearance`
 * switches it rather than forking a second menu that would drift.
 */

import { MoreVertical, MoreHorizontal, Pencil, FileText, MessageCircle, Share2, UserPlus, Trash2 } from 'lucide-react'
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
  onStatement: () => void
  onInvite: () => void
  onDelete: () => void
  /** Invite shown only when the portal is not yet claimed */
  showInvite: boolean
  /**
   * `hero` — the ⋮ inside the emerald header (inherits the header's own colour).
   * `inline` — the ⋯ that ends the action row: a fixed 44×44 square that must
   * line up with the two buttons beside it, so it takes the row's class.
   */
  appearance?: 'hero' | 'inline'
}

export function PartyDetailMenu({
  onEdit,
  onInvoice,
  onShare,
  onStatement,
  onInvite,
  onDelete,
  showInvite,
  appearance = 'hero',
}: PartyDetailMenuProps) {
  const { t } = useLanguage()
  const isInline = appearance === 'inline'
  const TriggerIcon = isInline ? MoreHorizontal : MoreVertical

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={isInline ? 'pd-actions__more' : undefined}
          aria-label={t.moreActions}
        >
          <TriggerIcon size={18} aria-hidden="true" />
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
        <DropdownMenuItem onSelect={onStatement}>
          <MessageCircle size={16} aria-hidden="true" />
          <span>{t.whatsappStatement}</span>
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
