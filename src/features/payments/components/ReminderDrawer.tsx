/** Reminder Drawer — send payment reminder via WhatsApp deep link
 *
 * Constructs a WhatsApp wa.me URL with pre-filled message.
 * No backend API needed — opens WhatsApp directly on the device.
 */

import { useState } from 'react'
import { MessageCircle, Copy, Check } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { APP_NAME } from '@/config/app.config'
import '../reminder-drawer.css'

interface ReminderDrawerProps {
  open: boolean
  onClose: () => void
  partyName: string
  partyPhone: string
  /** Outstanding amount in paise */
  outstanding: number
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(Math.abs(paise) / 100)
}

function buildReminderMessage(partyName: string, amount: number): string {
  return `Hi ${partyName},\n\nThis is a friendly reminder that you have an outstanding balance of ${formatAmount(amount)}.\n\nPlease arrange the payment at your earliest convenience.\n\nThank you,\n${APP_NAME}`
}

function sanitizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Indian numbers: add 91 prefix if missing
  if (digits.length === 10) return `91${digits}`
  return digits
}

export function ReminderDrawer({ open, onClose, partyName, partyPhone, outstanding }: ReminderDrawerProps) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const message = buildReminderMessage(partyName, outstanding)
  const phone = sanitizePhone(partyPhone)
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — ignore
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={t.sendReminderTitle} size="sm">
      <div className="reminder-drawer py-0">
        <p className="reminder-drawer-to py-0">
          {t.toColon} <strong>{partyName}</strong> ({partyPhone})
        </p>

        <div className="reminder-drawer-preview py-0">
          <p className="reminder-drawer-preview-text py-0">{message}</p>
        </div>

        <div className="reminder-drawer-actions py-0">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-md reminder-drawer-wa py-0"
            aria-label={`${t.sendReminderViaWa} ${partyName}`}
          >
            <MessageCircle size={18} aria-hidden="true" />
            {t.sendViaWhatsApp}
          </a>

          <button
            type="button"
            className="btn btn-ghost btn-md reminder-drawer-copy py-0"
            onClick={handleCopy}
            aria-label={copied ? t.messageCopied : t.copyToClipboard}
          >
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? t.copied : t.copyMessage}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
