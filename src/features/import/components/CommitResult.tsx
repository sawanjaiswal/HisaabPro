/**
 * Phase 7 Slice 7.1A FE.5 — Commit result view.
 *
 * Rendered when the polled job flips to COMMITTED or PARTIALLY_COMMITTED.
 *
 * Shows:
 *   - success header (full vs partial),
 *   - counts (created, overwritten, skipped, errors),
 *   - download-error-CSV CTA when errorCount > 0,
 *   - nav CTAs: "Import another file" → /imports, "View parties" → /parties.
 *
 * Why counts come from `job.counts` (not the commit mutation response):
 *   the COMMITTED status flip is owned by the polling query, and users
 *   may also land here directly (refresh after commit). The mutation
 *   response is purely transient — `job.counts` is authoritative.
 *
 * Error CSV download uses `window.location.href` (same-origin cookie
 * auth) — see services/import.service.ts `downloadErrorCsv`.
 */

import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'
import type { ImportJobView } from '../types/import.types'
import { downloadErrorCsv } from '../services/import.service'
import { clearCommitToken } from '../utils/commit-token-store'

interface CommitResultProps {
  job: ImportJobView['job']
  t: Record<string, string>
}

interface ResultCounts {
  created: number
  overwritten: number
  skipped: number
  errors: number
}

function readCounts(job: ImportJobView['job']): ResultCounts {
  // BE writes `counts` as ImportJobCounts (committed: number). The
  // `committed` field is the post-commit total (creates + overwrites)
  // — we cannot split it without an extra column, so we surface it
  // under a single "saved" stat plus the always-known error / skip
  // numbers. errorCount is also persisted on the job row.
  const raw = (job.counts as Record<string, unknown> | null) ?? {}
  const num = (k: string): number => {
    const v = raw[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }
  return {
    created: num('committed'),
    // BE doesn't currently persist a separate `overwritten` count on
    // the job row — surface 0 here and let the toast / mutation
    // result carry the breakdown for the current session. The result
    // page is authoritative for "what was saved", not "how".
    overwritten: num('overwritten'),
    skipped: num('skipped'),
    errors: job.errorCount,
  }
}

export function CommitResult({ job, t }: CommitResultProps) {
  const navigate = useNavigate()
  const counts = readCounts(job)
  const isPartial = job.status === 'PARTIALLY_COMMITTED'
  const isProduct = job.entity === 'product'

  // Token is single-use server-side; clearing it here prevents stale
  // tokens from sitting in sessionStorage until tab close.
  clearCommitToken(job.id)

  const onImportAnother = () => navigate(ROUTES.IMPORTS)
  const onViewEntities = () => {
    if (isProduct) {
      // Deep-link to the product list filtered by this import job (BE
      // accepts ?importJobId= — see ARCH conformance map L725).
      const productsRoute = (ROUTES as Record<string, string | undefined>).PRODUCTS
        ?? '/products'
      navigate(`${productsRoute}?importJobId=${encodeURIComponent(job.id)}`)
      return
    }
    navigate(ROUTES.PARTIES)
  }
  const onDownloadCsv = () => downloadErrorCsv(job.id)

  return (
    <div className="space-y-4">
      <Card variant="default" className="p-4 space-y-3">
        <h2
          className="font-semibold"
          style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
        >
          {isPartial
            ? (t.importResultPartialTitle ?? 'Import partially saved')
            : (t.importResultTitle ?? 'Import complete')}
        </h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
          {isPartial
            ? (t.importResultPartialBody ??
              'Some rows could not be saved. Download the error CSV to see what went wrong.')
            : isProduct
              ? (t.importResultBodyProduct ?? 'Your products are now part of your business.')
              : (t.importResultBody ?? 'Your parties are now part of your business.')}
        </p>

        <dl className="space-y-2 pt-2">
          <ResultCountRow
            label={
              isProduct
                ? (t.importResultCountSavedProduct ?? 'Products saved')
                : (t.importResultCountSaved ?? 'Parties saved')
            }
            value={counts.created + counts.overwritten}
          />
          <ResultCountRow
            label={t.importResultCountSkipped ?? 'Duplicates skipped'}
            value={counts.skipped}
          />
          <ResultCountRow
            label={t.importResultCountErrors ?? 'Rows with errors'}
            value={counts.errors}
          />
        </dl>
      </Card>

      {counts.errors > 0 && (
        <Button
          variant="secondary"
          size="lg"
          onClick={onDownloadCsv}
          className="w-full min-h-[44px]"
        >
          {t.importResultDownloadCsv ?? 'Download error CSV'}
        </Button>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={onImportAnother}
          className="min-h-[44px] flex-1"
        >
          {t.importResultImportAnother ?? 'Import another file'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onViewEntities}
          className="min-h-[44px] flex-1"
        >
          {isProduct
            ? (t.importResultViewProducts ?? 'View products')
            : (t.importResultViewParties ?? 'View parties')}
        </Button>
      </div>
    </div>
  )
}

function ResultCountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {label}
      </dt>
      <dd
        className="font-semibold tabular-nums"
        style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)' }}
      >
        {value}
      </dd>
    </div>
  )
}
