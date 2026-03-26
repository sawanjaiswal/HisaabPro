/** Public Ledger — Unauthenticated shared ledger view (lazy loaded) */

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from '@/components/feedback/Spinner'
import { ErrorState } from '@/components/feedback/ErrorState'
import { getPublicLedger } from './shared-ledger.service'
import { PublicLedgerView } from './components/PublicLedgerView'
import type { PublicLedgerData } from './shared-ledger.types'
import './shared-ledger.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function PublicLedgerPage() {
  const { t } = useLanguage()
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicLedgerData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!token) { setError(t.invalidLink); setIsLoading(false); return }

    abortRef.current = new AbortController()
    setIsLoading(true)

    getPublicLedger(token, abortRef.current.signal)
      .then(setData)
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err?.message === '404' ? t.linkExpiredRevoked : t.couldNotLoadLedger)
      })
      .finally(() => setIsLoading(false))

    return () => { abortRef.current?.abort() }
  }, [token])

  if (isLoading) return <Spinner fullScreen />
  if (error || !data) {
    return (
      <div className="public-ledger-page">
        <ErrorState
          title={t.linkNotAvailable}
          message={error ?? t.linkNoLongerValid}
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
