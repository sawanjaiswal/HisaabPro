/** InviteSignupFlow — new-user signup branch of the public invite page (Epic C PR5) */

import { useState, useCallback, FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface InviteSignupFlowStrings {
  inviteSignupTitle:         string
  inviteSignupNameLabel:     string
  inviteSignupPasswordLabel: string
  inviteSignupConfirmLabel:  string
  inviteSignupCta:           string
  loading:                   string
  retry:                     string
}

interface InviteSignupFlowProps {
  s:           InviteSignupFlowStrings
  defaultName: string
  onClaim:     (name: string, password: string) => Promise<void>
}

export function InviteSignupFlow({ s, defaultName, onClaim }: InviteSignupFlowProps) {
  const [name, setName]         = useState(defaultName)
  const [pw, setPw]             = useState('')
  const [confirm, setConfirm]   = useState('')
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim())         errs['name']    = 'Name is required'
    if (pw.length < 8)        errs['pw']      = 'Password must be at least 8 characters'
    if (pw !== confirm)       errs['confirm'] = 'Passwords do not match'
    setFieldErr(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setBusy(true); setErr('')
    try {
      await onClaim(name.trim(), pw)
    } catch {
      setErr(s.retry)
    } finally {
      setBusy(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, pw, confirm, onClaim, s.retry])

  return (
    <div className="inv-flow">
      <h2 className="inv-flow__title">{s.inviteSignupTitle}</h2>
      {err && <p className="inv-flow__err" role="alert">{err}</p>}
      <form className="inv-signup-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="inv-signup-field">
          <label htmlFor="inv-name" className="inv-signup-label">{s.inviteSignupNameLabel}</label>
          <Input
            id="inv-name"
            type="text"
            className={`input${fieldErr['name'] ? ' input--error' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          {fieldErr['name'] && <p className="inv-flow__field-err" role="alert">{fieldErr['name']}</p>}
        </div>

        <div className="inv-signup-field">
          <label htmlFor="inv-pw" className="inv-signup-label">{s.inviteSignupPasswordLabel}</label>
          <Input
            id="inv-pw"
            type="password"
            className={`input${fieldErr['pw'] ? ' input--error' : ''}`}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
          {fieldErr['pw'] && <p className="inv-flow__field-err" role="alert">{fieldErr['pw']}</p>}
        </div>

        <div className="inv-signup-field">
          <label htmlFor="inv-confirm" className="inv-signup-label">{s.inviteSignupConfirmLabel}</label>
          <Input
            id="inv-confirm"
            type="password"
            className={`input${fieldErr['confirm'] ? ' input--error' : ''}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {fieldErr['confirm'] && <p className="inv-flow__field-err" role="alert">{fieldErr['confirm']}</p>}
        </div>

        <Button
          type="submit"
          variant="primary" size="lg" className="inv-flow__cta"
          disabled={busy}
        >
          {busy ? s.loading : s.inviteSignupCta}
        </Button>
      </form>
    </div>
  )
}
