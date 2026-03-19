import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, CheckCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { ROUTES } from '@/config/routes.config'
import * as authLib from '@/lib/auth'
import { ApiError } from '@/lib/api'
import './join-business.css'

export default function JoinBusinessPage() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ businessName: string; roleName: string } | null>(null)
  const submitting = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleCodeChange = (value: string) => {
    // Only allow alphanumeric uppercase, max 6 chars
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
    setCode(cleaned)
    setError('')
  }

  const handleSubmit = async () => {
    if (submitting.current || code.length !== 6) return
    submitting.current = true
    setLoading(true)
    setError('')

    try {
      const result = await authLib.joinBusiness(code)
      setSuccess({
        businessName: result.business.name,
        roleName: result.businessUser.role,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join business')
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleGoToDashboard = () => {
    // Reload to pick up new business context
    window.location.href = ROUTES.DASHBOARD
  }

  if (success) {
    return (
      <div className="join-business-page">
        <Header title="Join Business" backTo={ROUTES.SETTINGS} />
        <div className="join-business-content">
          <div className="join-business-success">
            <CheckCircle size={48} className="join-business-success-icon" />
            <h2 className="join-business-success-title">
              You joined {success.businessName}!
            </h2>
            <p className="join-business-success-subtitle">
              Role: {success.roleName}
            </p>
            <button
              type="button"
              className="join-business-btn"
              onClick={handleGoToDashboard}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="join-business-page">
      <Header title="Join Business" backTo={ROUTES.SETTINGS} />
      <div className="join-business-content">
        <div className="join-business-icon-container">
          <Building2 size={40} className="join-business-icon" />
        </div>
        <h2 className="join-business-heading">Enter Invite Code</h2>
        <p className="join-business-subtitle">
          Ask the business owner for a 6-character invite code
        </p>

        <input
          ref={inputRef}
          type="text"
          className="join-business-input"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="XXXXXX"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Invite code"
        />

        {error && <p className="join-business-error">{error}</p>}

        <button
          type="button"
          className="join-business-btn"
          disabled={code.length !== 6 || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Joining...' : 'Join Business'}
        </button>
      </div>
    </div>
  )
}
