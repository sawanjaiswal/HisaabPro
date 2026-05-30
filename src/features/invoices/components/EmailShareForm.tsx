/** EmailShareForm — collect recipient + message, then email the invoice PDF (#32).
 *
 * Shown inside ShareInvoiceDrawer when the user picks "Email". The PDF itself is
 * rendered client-side and uploaded by useShareInvoice.handleEmail.
 */

import { useState } from 'react'
import { Mail, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { Textarea } from '@/components/ui/Textarea'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  documentNumber: string
  partyName: string
  /** Pre-fill when the party has an email on file. */
  defaultEmail?: string
  isSending: boolean
  onSend: (email: string, subject: string, body: string) => void
  onBack: () => void
}

export function EmailShareForm({ documentNumber, partyName, defaultEmail, isSending, onSend, onBack }: Props) {
  const { t } = useLanguage()
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [subject, setSubject] = useState(`${t.invoice} ${documentNumber}`)
  const [body, setBody] = useState('')
  const [touched, setTouched] = useState(false)

  const emailError = touched && !EMAIL_RE.test(email.trim()) ? t.enterValidEmail : undefined

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!EMAIL_RE.test(email.trim()) || !subject.trim()) return
    onSend(email.trim(), subject.trim(), body.trim())
  }

  return (
    <form className="email-share-form space-y-4" onSubmit={submit} aria-label={t.emailInvoice}>
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={onBack}
        disabled={isSending}
        aria-label={t.back}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{t.back}</span>
      </Button>

      <Input
        label={t.recipientEmail}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={`${partyName.toLowerCase().replace(/\s+/g, '')}@example.com`}
        error={emailError}
        icon={<Mail size={16} aria-hidden="true" />}
        autoComplete="email"
        required
      />

      <Input
        label={t.subject}
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={200}
        required
      />

      <div className="input-group">
        <label htmlFor="email-share-body" className="input-label">{t.messageOptional}</label>
        <Textarea
          id="email-share-body"
          className="input min-h-[88px] resize-y"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          placeholder={t.emailBodyPlaceholder}
        />
      </div>

      <Button type="submit" variant="primary" size="md" loading={isSending} className="w-full">
        <Mail size={16} aria-hidden="true" />
        <span>{t.sendInvoiceEmail}</span>
      </Button>
    </form>
  )
}
