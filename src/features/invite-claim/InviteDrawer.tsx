/** InviteDrawer — auth-side drawer shown after issuing an invite link (Epic C PR5) */

import { useState, useCallback } from 'react'
import { Copy, MessageSquare, AlertCircle } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { issueInvite } from './invite-claim.service'
import type { InviteIssueResponse } from './invite-claim.types'
import './invite-drawer.css'

interface InviteDrawerProps {
  partyId:    string
  partyName:  string
  partyPhone: string | undefined
  onClose:    () => void
}

type DrawerState = 'loading' | 'error' | 'ready'

function buildWhatsAppLink(phone: string | undefined, url: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  const text = encodeURIComponent(`You've been invited to HisaabPro! Click here to claim your account: ${url}`)
  return `https://wa.me/${digits}?text=${text}`
}

export function InviteDrawer({ partyId, partyName, partyPhone, onClose }: InviteDrawerProps) {
  const { t } = useLanguage()
  const toast = useToast()

  const [state, setState] = useState<DrawerState>('loading')
  const [invite, setInvite] = useState<InviteIssueResponse | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch invite on first render of the open drawer
  const doIssue = useCallback(async () => {
    setState('loading')
    try {
      const data = await issueInvite(partyId)
      setInvite(data)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [partyId])

  // Run once on mount via ref trick — avoids useEffect dep issues
  const [issued, setIssued] = useState(false)
  if (!issued) {
    setIssued(true)
    void doIssue()
  }

  const fullUrl = invite ? `${window.location.origin}${invite.url}` : ''
  const waLink  = buildWhatsAppLink(partyPhone, fullUrl)

  const handleCopy = async () => {
    if (!fullUrl) return
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    toast.success(t.inviteToPortalCopyCta)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Drawer open onClose={onClose} title={t.inviteToPortalDrawerTitle} size="sm">
      <div className="inv-drawer">
        {state === 'loading' && (
          <div className="inv-drawer__loading" role="status" aria-live="polite">
            <div className="inv-drawer__skeleton" />
            <div className="inv-drawer__skeleton inv-drawer__skeleton--short" />
          </div>
        )}

        {state === 'error' && (
          <div className="inv-drawer__error" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <p>{t.inviteLoadFailed}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void doIssue()}>
              {t.retry}
            </button>
          </div>
        )}

        {state === 'ready' && invite && (
          <>
            <p className="inv-drawer__party">{partyName}</p>

            <div className="inv-drawer__url-block" aria-label={t.inviteToPortalUrlLabel}>
              <span className="inv-drawer__url">{fullUrl}</span>
            </div>

            <p className="inv-drawer__one-time">{t.inviteToPortalOneTime}</p>

            <div className="inv-drawer__actions">
              <button
                type="button"
                className="btn btn-primary btn-md inv-drawer__action-btn"
                onClick={() => void handleCopy()}
              >
                <Copy size={16} aria-hidden="true" />
                {copied ? t.copied : t.inviteToPortalCopyCta}
              </button>

              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-md inv-drawer__action-btn"
                >
                  <MessageSquare size={16} aria-hidden="true" />
                  {t.inviteToPortalWhatsappCta}
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
