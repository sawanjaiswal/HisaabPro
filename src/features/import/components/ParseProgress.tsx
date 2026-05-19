/**
 * Phase 7 Slice 7.1A FE.2 — "Parsing your file…" panel.
 *
 * Visible while `status === 'PARSING' | 'UPLOADED'`. Shows file name,
 * format label, elapsed-time counter, and a Skeleton placeholder for
 * the upcoming preview table. Polling itself is owned by the page.
 */

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Spinner } from '@/components/feedback/Spinner'
import type { ImportFormat } from '../types/import.types'

interface ParseProgressProps {
  fileName: string | null
  format: ImportFormat
  /** ISO timestamp when the job was created (BE `createdAt`). */
  startedAt: string
  t: Record<string, string>
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

export function ParseProgress({ fileName, format, startedAt, t }: ParseProgressProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const startedMs = new Date(startedAt).getTime()
  const elapsed = Number.isFinite(startedMs) ? now - startedMs : 0

  const formatLabel = t[`importFormat_${format}_short`] ?? format

  return (
    <Card variant="default" className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface-alt)',
            color: 'var(--color-text-secondary)',
          }}
          aria-hidden="true"
        >
          <FileText size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className="font-semibold truncate"
            style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
          >
            {t.importParseProgressTitle ?? 'Parsing your file…'}
          </h2>
          <p
            className="truncate"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}
          >
            {fileName ?? t.importParseProgressUnknownFile ?? 'Uploaded file'}
            {' · '}
            {formatLabel}
            {' · '}
            <span className="tabular-nums">{formatElapsed(elapsed)}</span>
          </p>
        </div>
        <Spinner size="sm" />
      </div>

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {t.importParseProgressBody ??
          'This usually takes a few seconds. Stay on this screen — we will show the preview as soon as it is ready.'}
      </p>

      <div className="space-y-2" aria-hidden="true">
        <Skeleton height="0.75rem" width="75%" />
        <Skeleton height="0.75rem" width="92%" />
        <Skeleton height="0.75rem" width="60%" />
        <Skeleton height="0.75rem" width="84%" />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {t.importParseProgressTitle ?? 'Parsing your file…'}
      </span>
    </Card>
  )
}
