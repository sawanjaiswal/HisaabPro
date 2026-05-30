/** InviteOtpFlow — existing-user OTP branch of the public invite page (Epic C PR5) */

import { useState, useRef, useCallback, KeyboardEvent, ClipboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface InviteOtpFlowStrings {
  inviteOtpTitle:     string
  inviteOtpSendCta:   string
  inviteOtpSent:      string
  inviteOtpCodeLabel: string
  inviteOtpResend:    string
  inviteOtpVerifyCta: string
  inviteClaimCta:     string
  inviteOtpInvalid:   string
  loading:            string
  retry:              string
}

interface InviteOtpFlowProps {
  s:                InviteOtpFlowStrings
  maskedPhone:      string
  onSendOtp:        () => Promise<string>           // returns otpSessionId
  onVerifyOtp:      (sessionId: string, code: string) => Promise<string> // returns otpVerifiedToken
  onClaim:          (otpVerifiedToken: string) => Promise<void>
}

type OtpState = 'send' | 'enter' | 'verified'

const OTP_LEN = 6

export function InviteOtpFlow({ s, maskedPhone, onSendOtp, onVerifyOtp, onClaim }: InviteOtpFlowProps) {
  const [phase, setPhase] = useState<OtpState>('send')
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''))
  const [sessionId, setSessionId] = useState('')
  const [verifiedToken, setVerifiedToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleSend = useCallback(async () => {
    setBusy(true); setErr('')
    try {
      const id = await onSendOtp()
      setSessionId(id)
      setPhase('enter')
      setTimeout(() => inputRefs.current[0]?.focus(), 80)
    } catch {
      setErr(s.retry)
    } finally {
      setBusy(false)
    }
  }, [onSendOtp, s.retry])

  const handleVerify = useCallback(async () => {
    const code = digits.join('')
    if (code.length < OTP_LEN) return
    setBusy(true); setErr('')
    try {
      const token = await onVerifyOtp(sessionId, code)
      setVerifiedToken(token)
      setPhase('verified')
    } catch {
      setErr(s.inviteOtpInvalid)
      setDigits(Array(OTP_LEN).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 80)
    } finally {
      setBusy(false)
    }
  }, [digits, sessionId, onVerifyOtp, s.inviteOtpInvalid])

  const handleClaim = useCallback(async () => {
    setBusy(true); setErr('')
    try {
      await onClaim(verifiedToken)
    } catch {
      setErr(s.retry)
    } finally {
      setBusy(false)
    }
  }, [verifiedToken, onClaim, s.retry])

  const onDigitKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  const onDigitChange = (i: number, val: string) => {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < OTP_LEN - 1) inputRefs.current[i + 1]?.focus()
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN)
    const next = Array(OTP_LEN).fill('')
    raw.split('').forEach((ch, idx) => { next[idx] = ch })
    setDigits(next)
    const focusIdx = Math.min(raw.length, OTP_LEN - 1)
    inputRefs.current[focusIdx]?.focus()
  }

  if (phase === 'send') return (
    <div className="inv-flow">
      <h2 className="inv-flow__title">{s.inviteOtpTitle}</h2>
      <p className="inv-flow__sub">{s.inviteOtpSent.replace('{phone}', maskedPhone)}</p>
      {err && <p className="inv-flow__err" role="alert">{err}</p>}
      <Button type="button" variant="primary" size="lg" className="inv-flow__cta" onClick={() => void handleSend()} disabled={busy}>
        {busy ? s.loading : s.inviteOtpSendCta}
      </Button>
    </div>
  )

  if (phase === 'enter') return (
    <div className="inv-flow">
      <h2 className="inv-flow__title">{s.inviteOtpTitle}</h2>
      <p className="inv-flow__sub">{s.inviteOtpSent.replace('{phone}', maskedPhone)}</p>
      <fieldset className="inv-otp-group" aria-label={s.inviteOtpCodeLabel}>
        <legend className="sr-only">{s.inviteOtpCodeLabel}</legend>
        {digits.map((d, i) => (
          <Input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            aria-label={`Digit ${i + 1}`}
            className="inv-otp-box"
            onChange={(e) => onDigitChange(i, e.target.value)}
            onKeyDown={(e) => onDigitKey(i, e)}
            onPaste={onPaste}
          />
        ))}
      </fieldset>
      {err && <p className="inv-flow__err" role="alert">{err}</p>}
      <Button type="button" variant="primary" size="lg" className="inv-flow__cta"
        onClick={() => void handleVerify()} disabled={busy || digits.join('').length < OTP_LEN}>
        {busy ? s.loading : s.inviteOtpVerifyCta}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="inv-flow__resend" onClick={() => void handleSend()} disabled={busy}>
        {s.inviteOtpResend}
      </Button>
    </div>
  )

  return (
    <div className="inv-flow">
      <p className="inv-flow__sub">{s.inviteOtpSent.replace('{phone}', maskedPhone)}</p>
      {err && <p className="inv-flow__err" role="alert">{err}</p>}
      <Button type="button" variant="primary" size="lg" className="inv-flow__cta" onClick={() => void handleClaim()} disabled={busy}>
        {busy ? s.loading : s.inviteClaimCta}
      </Button>
    </div>
  )
}
