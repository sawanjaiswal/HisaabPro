/** Public Ledger — Unauthenticated shared ledger view (lazy loaded) */

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from '@/components/feedback/Spinner'
import { ErrorState } from '@/components/feedback/ErrorState'
import { getPublicLedger } from './shared-ledger.service'
import { PublicLedgerView } from './components/PublicLedgerView'
import type { PublicLedgerData } from './shared-ledger.types'
import './shared-ledger.css'

export default function PublicLedgerPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicLedgerData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!token) { setError('Invalid link'); setIsLoading(false); return }

    abortRef.current = new AbortController()
    setIsLoading(true)

    getPublicLedger(token, abortRef.current.signal)
      .then(setData)
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err?.message === '404' ? 'This link has expired or been revoked.' : 'Could not load ledger. Please try again.')
      })
      .finally(() => setIsLoading(false))

    return () => { abortRef.current?.abort() }
  }, [token])

  if (isLoading) return <Spinner fullScreen />
  if (error || !data) {
    return (
      <div className="public-ledger-page">
        <ErrorState
          title="Link Not Available"
          message={error ?? 'This shared ledger link is no longer valid.'}
        />
      </div>
    )
  }

  return (
    <div className="public-ledger-page">
      <PublicLedgerView data={data} />
    </div>
  )
}
