/** PublicInvitePage — /p/invite/:token (Epic C PR5 / #131)
 *
 * 4 UI states: loading | error (revoked/expired/not-found/generic) | preview+flow | claimed.
 * Supports ?lang=hi via PublicShell outlet context.
 * 320px tested. No auth required.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useOutletContext, Link } from 'react-router-dom'
import { Clock, Link2Off, CheckCircle, AlertCircle } from 'lucide-react'
import {
  getInvitePreview,
  sendInviteOtp,
  verifyInviteOtp,
  claimInvite,
} from '@/features/invite-claim/invite-claim.service'
import { InviteOtpFlow }    from '@/features/invite-claim/InviteOtpFlow'
import { InviteSignupFlow } from '@/features/invite-claim/InviteSignupFlow'
import type { InvitePreview, InvitePageStatus } from '@/features/invite-claim/invite-claim.types'
import type { PublicLang }  from '@/features/public/hooks/usePublicLang'
import './public-invite.css'

// ─── Strings ─────────────────────────────────────────────────────────────────

const S = {
  en: {
    loading:                   'Loading invite...',
    inviteClaimGreeting:       '{partyName}, {businessName} has invited you to HisaabPro',
    invitePhonePreview:        'Registered number: {phone}',
    inviteExpiresAt:           'Link expires: {date}',
    inviteExpired:             'This invite link has expired.',
    inviteRevoked:             'This invite link has been revoked.',
    inviteAlreadyClaimed:      'This account has already been claimed.',
    inviteNotFound:            'Invite link not found.',
    inviteLoadFailed:          "Couldn't load the invite. Please try again.",
    inviteClaimSuccess:        'Account linked successfully!',
    inviteClaimRedirectToLogin:'Sign in to continue',
    inviteOtpInvalid:          'Incorrect OTP. Please try again.',
    inviteOtpTitle:            'Verify your number',
    inviteOtpSendCta:          'Send OTP',
    inviteOtpSent:             'We\'ll send an OTP to {phone}',
    inviteOtpCodeLabel:        'Enter 6-digit OTP',
    inviteOtpResend:           'Resend OTP',
    inviteOtpVerifyCta:        'Verify',
    inviteClaimCta:            'Link my account',
    inviteSignupTitle:         'Create your account',
    inviteSignupNameLabel:     'Your name',
    inviteSignupPasswordLabel: 'Password',
    inviteSignupConfirmLabel:  'Confirm password',
    inviteSignupCta:           'Create account & link',
    loading_btn:               'Please wait...',
    retry:                     'Try again',
  },
  hi: {
    loading:                   'आमंत्रण लोड हो रहा है...',
    inviteClaimGreeting:       '{partyName}, {businessName} ने आपको HisaabPro पर आमंत्रित किया है',
    invitePhonePreview:        'पंजीकृत नंबर: {phone}',
    inviteExpiresAt:           'लिंक समाप्त होगा: {date}',
    inviteExpired:             'यह आमंत्रण लिंक समाप्त हो गया है।',
    inviteRevoked:             'यह आमंत्रण लिंक रद्द कर दिया गया है।',
    inviteAlreadyClaimed:      'यह खाता पहले ही क्लेम किया जा चुका है।',
    inviteNotFound:            'आमंत्रण लिंक नहीं मिला।',
    inviteLoadFailed:          'आमंत्रण लोड नहीं हो सका। कृपया पुनः प्रयास करें।',
    inviteClaimSuccess:        'खाता सफलतापूर्वक लिंक हो गया!',
    inviteClaimRedirectToLogin:'जारी रखने के लिए साइन इन करें',
    inviteOtpInvalid:          'गलत OTP। कृपया पुनः प्रयास करें।',
    inviteOtpTitle:            'अपना नंबर सत्यापित करें',
    inviteOtpSendCta:          'OTP भेजें',
    inviteOtpSent:             '{phone} पर OTP भेजा जाएगा',
    inviteOtpCodeLabel:        '6-अंकी OTP दर्ज करें',
    inviteOtpResend:           'OTP फिर से भेजें',
    inviteOtpVerifyCta:        'सत्यापित करें',
    inviteClaimCta:            'मेरा खाता लिंक करें',
    inviteSignupTitle:         'अपना खाता बनाएं',
    inviteSignupNameLabel:     'आपका नाम',
    inviteSignupPasswordLabel: 'पासवर्ड',
    inviteSignupConfirmLabel:  'पासवर्ड की पुष्टि करें',
    inviteSignupCta:           'खाता बनाएं और लिंक करें',
    loading_btn:               'कृपया प्रतीक्षा करें...',
    retry:                     'पुनः प्रयास',
  },
} as const

interface OutletCtx { lang: PublicLang }

function fmt(tpl: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), tpl)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublicInvitePage() {
  const { token }  = useParams<{ token: string }>()
  const ctx        = useOutletContext<OutletCtx>()
  const lang: PublicLang = ctx?.lang ?? 'en'
  const s = S[lang]

  const [status, setStatus]   = useState<InvitePageStatus>('loading')
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [claimed, setClaimed] = useState(false)

  const doFetch = useCallback(async () => {
    if (!token) { setStatus('not-found'); return }
    setStatus('loading')
    try {
      const data = await getInvitePreview(token)
      setPreview(data)
      setStatus('preview')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      const st   = (err as { status?: number })?.status
      if (code === 'LINK_REVOKED')   setStatus('revoked')
      else if (code === 'LINK_CONSUMED') setStatus('consumed')
      else if (st === 410)           setStatus('expired')
      else if (st === 404)           setStatus('not-found')
      else                           setStatus('error')
    }
  }, [token])

  useEffect(() => { void doFetch() }, [doFetch])

  // ── OTP handlers ──
  const handleSendOtp = useCallback(async () => {
    const r = await sendInviteOtp(token!)
    return r.otpSessionId
  }, [token])

  const handleVerifyOtp = useCallback(async (sessionId: string, code: string) => {
    const r = await verifyInviteOtp(token!, { otpSessionId: sessionId, code })
    return r.otpVerifiedToken
  }, [token])

  const handleClaimExisting = useCallback(async (otpVerifiedToken: string) => {
    await claimInvite(token!, { kind: 'existing', otpVerifiedToken })
    setClaimed(true)
  }, [token])

  const handleClaimSignup = useCallback(async (name: string, password: string) => {
    await claimInvite(token!, { kind: 'signup', name, password })
    setClaimed(true)
  }, [token])

  // ── Loading ──
  if (status === 'loading') return (
    <div className="pub-invite-skeleton" role="status" aria-label={s.loading} aria-live="polite">
      <div className="pub-invite-skeleton__bar pub-invite-skeleton__bar--wide" />
      <div className="pub-invite-skeleton__bar pub-invite-skeleton__bar--mid" />
      <div className="pub-invite-skeleton__bar pub-invite-skeleton__bar--full pub-invite-skeleton__bar--tall" />
    </div>
  )

  // ── Terminal error states ──
  if (status === 'expired') return (
    <div className="pub-invite-status" role="alert">
      <div className="pub-invite-status__icon pub-invite-status__icon--warn"><Clock size={28} /></div>
      <p className="pub-invite-status__title">{s.inviteExpired}</p>
    </div>
  )
  if (status === 'revoked') return (
    <div className="pub-invite-status" role="alert">
      <div className="pub-invite-status__icon pub-invite-status__icon--warn"><Link2Off size={28} /></div>
      <p className="pub-invite-status__title">{s.inviteRevoked}</p>
    </div>
  )
  if (status === 'consumed') return (
    <div className="pub-invite-status" role="alert">
      <div className="pub-invite-status__icon pub-invite-status__icon--ok"><CheckCircle size={28} /></div>
      <p className="pub-invite-status__title">{s.inviteAlreadyClaimed}</p>
      <Link to="/login" className="pub-invite-status__link">{s.inviteClaimRedirectToLogin}</Link>
    </div>
  )
  if (status === 'not-found' || status === 'error') return (
    <div className="pub-invite-status" role="alert">
      <div className="pub-invite-status__icon pub-invite-status__icon--error"><AlertCircle size={28} /></div>
      <p className="pub-invite-status__title">{status === 'not-found' ? s.inviteNotFound : s.inviteLoadFailed}</p>
      {status === 'error' && (
        <button type="button" className="pub-invite-status__retry" onClick={() => void doFetch()}>{s.retry}</button>
      )}
    </div>
  )

  // ── Claimed success ──
  if (claimed) return (
    <div className="pub-invite-status" role="status">
      <div className="pub-invite-status__icon pub-invite-status__icon--ok"><CheckCircle size={28} /></div>
      <p className="pub-invite-status__title">{s.inviteClaimSuccess}</p>
      <Link to="/login" className="pub-invite-status__link">{s.inviteClaimRedirectToLogin}</Link>
    </div>
  )

  // ── Preview + flow ──
  if (status === 'preview' && preview) {
    const expiresFormatted = new Date(preview.expiresAt).toLocaleDateString()
    const flowS = { ...s, loading: s.loading_btn }
    return (
      <div className="pub-invite">
        <h1 className="pub-invite__greeting">
          {fmt(s.inviteClaimGreeting, { partyName: preview.partyName, businessName: preview.businessName })}
        </h1>
        <p className="pub-invite__meta">
          {fmt(s.invitePhonePreview, { phone: preview.partyPhoneMasked })}
          {' · '}
          {fmt(s.inviteExpiresAt, { date: expiresFormatted })}
        </p>
        <hr className="pub-invite__divider" aria-hidden="true" />
        {preview.requiresOtp
          ? <InviteOtpFlow
              s={{ ...flowS, inviteClaimCta: s.inviteClaimCta, inviteOtpInvalid: s.inviteOtpInvalid }}
              maskedPhone={preview.partyPhoneMasked}
              onSendOtp={handleSendOtp}
              onVerifyOtp={handleVerifyOtp}
              onClaim={handleClaimExisting}
            />
          : <InviteSignupFlow
              s={flowS}
              defaultName={preview.partyName}
              onClaim={handleClaimSignup}
            />
        }
      </div>
    )
  }

  return null
}
