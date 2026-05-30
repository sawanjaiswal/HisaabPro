/**
 * ReminderComposerSheet — 3-stage bulk reminder bottom sheet.
 *
 * Stage 1 — Compose: template chip selector, message textarea, preview.
 * Stage 2 — Sending: opens wa.me links sequentially with 2s pacing.
 * Stage 3 — Result: sent/excluded breakdown.
 *
 * MB-3: customMessage appended after render, never re-rendered.
 * MB-4: wa.me links from server — phone already validated server-side.
 */

import { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { useReminderComposer, type BulkReminderResult } from './useReminderComposer'
import { REMINDER_TEMPLATES, TEMPLATE_KEYS, type TemplateKey } from './reminder-templates'
import { ReminderPreview } from './components/ReminderPreview'
import { ReminderResultScreen } from './ReminderResultScreen'
import type { PartyInBucket } from './collections.types'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

type Stage = 'compose' | 'sending' | 'result'

interface Props {
  open: boolean
  onClose: () => void
  selectedParties: PartyInBucket[]
  businessName: string
}

function openWaLinksSequentially(links: string[]): void {
  links.forEach((link, i) => {
    setTimeout(() => {
      window.open(link, '_system')
    }, i * 2000)
  })
}

export function ReminderComposerSheet({ open, onClose, selectedParties, businessName }: Props) {
  const toast = useToast()
  const mutation = useReminderComposer()

  const [stage, setStage] = useState<Stage>('compose')
  const [templateKey, setTemplateKey] = useState<TemplateKey>('POLITE')
  const [customMessage, setCustomMessage] = useState('')
  const [result, setResult] = useState<BulkReminderResult | null>(null)
  const [openingCount, setOpeningCount] = useState(0)

  const validParties = selectedParties.filter((p) => p.phone)
  const noPhoneCount = selectedParties.length - validParties.length

  const handleSend = useCallback(() => {
    if (validParties.length === 0) return
    setStage('sending')

    const key = `bulk-${Date.now()}-${validParties.length}`
    mutation.mutate(
      {
        partyIds: validParties.map((p) => p.partyId),
        channel: 'WHATSAPP',
        templateKey,
        customMessage: customMessage.trim() || undefined,
        idempotencyKey: key,
      },
      {
        onSuccess: (data) => {
          setResult(data)
          // Open WhatsApp links sequentially with 2s pacing
          if (data?.waLinks?.length) {
            const links = data.waLinks.map((l) => l.waLink)
            setOpeningCount(links.length)
            openWaLinksSequentially(links)
          }
          setStage('result')
        },
        onError: (err) => {
          setStage('compose')
          toast.error(err.message || 'Failed to send reminders')
        },
      },
    )
  }, [validParties, templateKey, customMessage, mutation, toast])

  const handleClose = useCallback(() => {
    setStage('compose')
    setCustomMessage('')
    setResult(null)
    setOpeningCount(0)
    onClose()
  }, [onClose])

  const firstParty = validParties[0]

  return (
    <Drawer
      open={open}
      onClose={stage === 'sending' ? () => {} : handleClose}
      title={
        stage === 'compose'
          ? `Send Reminder (${validParties.length})`
          : stage === 'sending'
            ? 'Sending…'
            : 'Reminder Sent'
      }
      persistent={stage === 'sending'}
    >
      {stage === 'compose' && (
        <div className="reminder-composer">
          {/* Template chip selector */}
          <section className="reminder-composer__section">
            <p className="reminder-composer__label">Template</p>
            <div className="reminder-composer__chips" role="group" aria-label="Select template">
              {TEMPLATE_KEYS.map((key) => (
                <Button variant="none"
                  key={key}
                  type="button"
                  className={`reminder-composer__chip${templateKey === key ? ' reminder-composer__chip--active' : ''}`}
                  onClick={() => setTemplateKey(key)}
                  aria-pressed={templateKey === key}
                >
                  {REMINDER_TEMPLATES[key].label}
                </Button>
              ))}
            </div>
          </section>

          {/* Custom message */}
          <section className="reminder-composer__section">
            <label className="reminder-composer__label" htmlFor="custom-msg">
              Additional note (optional)
            </label>
            <Textarea
              id="custom-msg"
              className="reminder-composer__textarea"
              rows={3}
              maxLength={500}
              placeholder="e.g. Please use UPI for quick settlement"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
            />
          </section>

          {/* Preview */}
          {firstParty && (
            <ReminderPreview
              party={firstParty}
              templateKey={templateKey}
              customMessage={customMessage}
              businessName={businessName}
            />
          )}

          {/* Exclusion warning */}
          {noPhoneCount > 0 && (
            <p className="reminder-composer__warning" role="alert">
              {noPhoneCount} {noPhoneCount === 1 ? 'party' : 'parties'} skipped — no phone number
            </p>
          )}

          <div className="reminder-composer__footer">
            <Button variant="none"
              type="button"
              className="reminder-composer__send-btn"
              disabled={validParties.length === 0}
              onClick={handleSend}
            >
              Send to {validParties.length} {validParties.length === 1 ? 'party' : 'parties'}
            </Button>
          </div>
        </div>
      )}

      {stage === 'sending' && (
        <div className="reminder-composer reminder-composer--sending">
          <Loader2 size={32} className="reminder-composer__spinner" aria-hidden="true" />
          <p className="reminder-composer__sending-text">
            Opening WhatsApp for {openingCount} {openingCount === 1 ? 'party' : 'parties'}…
          </p>
        </div>
      )}

      {stage === 'result' && result && (
        <ReminderResultScreen result={result} onDone={handleClose} />
      )}
    </Drawer>
  )
}
