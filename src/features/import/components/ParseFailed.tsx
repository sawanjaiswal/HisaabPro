/**
 * Phase 7 Slice 7.1A FE.2 — "Parse failed" panel.
 *
 * Server marks the job FAILED for parser errors OR for the orphan-PARSING
 * cron (>5 min stuck). BE response carries `errorCount` + `counts`; there
 * is no free-text errorSummary on the FE contract today (see ARCHITECTURE
 * §3 and services/import/get.service.ts). We render a generic message plus
 * the row-error count if present, and offer a single recovery action:
 * cancel + return to the upload page so the user can retry from scratch.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'
import { useToast } from '@/hooks/useToast'
import { cancelImportJob } from '../services/import.service'

interface ParseFailedProps {
  jobId: string
  errorCount: number
  t: Record<string, string>
}

export function ParseFailed({ jobId, errorCount, t }: ParseFailedProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [working, setWorking] = useState(false)

  const handleCancelAndRetry = async () => {
    if (working) return
    setWorking(true)
    try {
      await cancelImportJob(jobId)
      toast.success(t.importParseFailedCancelled ?? 'Import cancelled. You can try again.')
      navigate(ROUTES.IMPORTS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : (t.importParseFailedCancelError ?? 'Could not cancel — please retry.')
      toast.error(msg)
      setWorking(false)
    }
  }

  return (
    <Card variant="default" className="p-4 space-y-4" role="alert">
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-danger-soft, var(--color-surface-alt))',
            color: 'var(--color-danger, var(--color-text-primary))',
          }}
          aria-hidden="true"
        >
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className="font-semibold"
            style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
          >
            {t.importParseFailedTitle ?? 'We could not read this file'}
          </h2>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
            {t.importParseFailedBody ??
              'The file format may be different from what was selected, or the file may be corrupt. Cancel this import and try again with a fresh export.'}
          </p>
        </div>
      </div>

      {errorCount > 0 && (
        <p
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}
        >
          {(t.importParseFailedErrorCount ?? 'Rows with errors:')}{' '}
          <span className="font-semibold tabular-nums">{errorCount}</span>
        </p>
      )}

      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={handleCancelAndRetry}
          loading={working}
          disabled={working}
          className="w-full md:w-auto min-h-[44px]"
        >
          {t.importParseFailedCancelAction ?? 'Cancel and retry'}
        </Button>
      </div>
    </Card>
  )
}
