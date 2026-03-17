/** Reminder Drawer — send payment reminder via WhatsApp deep link
 *
 * Constructs a WhatsApp wa.me URL with pre-filled message.
 * No backend API needed — opens WhatsApp directly on the device.
 */

import { useState } from 'react'
import { MessageCircle, Copy, Check } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
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
    <Drawer open={open} onClose={onClose} title="Send Reminder" size="sm">
      <div className="reminder-drawer">
        <p className="reminder-drawer-to">
          To: <strong>{partyName}</strong> ({partyPhone})
        </p>

        <div className="reminder-drawer-preview">
          <p className="reminder-drawer-preview-text">{message}</p>
        </div>

        <div className="reminder-drawer-actions">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-md reminder-drawer-wa"
            aria-label={`Send reminder to ${partyName} via WhatsApp`}
          >
            <MessageCircle size={18} aria-hidden="true" />
            Send via WhatsApp
          </a>

          <button
            type="button"
            className="btn btn-ghost btn-md reminder-drawer-copy"
            onClick={handleCopy}
            aria-label={copied ? 'Message copied' : 'Copy message to clipboard'}
          >
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? 'Copied!' : 'Copy Message'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
