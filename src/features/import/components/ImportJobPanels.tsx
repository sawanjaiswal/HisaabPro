/**
 * Phase 7 Slice 7.1A FE.2 / 7.1C — Status-panel atoms for ImportJobPage.
 *
 * Extracted from `ImportJobPage.tsx` so the orchestrator stays under the
 * 250L cap after the 7.1C invoice additions. Two pure components:
 *   - StubPanel    — title + body card (used for CANCELLED + unknown states)
 *   - CommittingPanel — spinner + title + body (used during commit in-flight)
 *
 * Token-only styling, no business logic.
 */

import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/feedback/Spinner'

interface PanelProps {
  title: string
  body: string
}

export function StubPanel({ title, body }: PanelProps) {
  return (
    <Card variant="default" className="p-4 space-y-2">
      <h2
        className="font-semibold"
        style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {body}
      </p>
    </Card>
  )
}

export function CommittingPanel({ title, body }: PanelProps) {
  return (
    <Card variant="default" className="p-6 flex flex-col items-center text-center gap-3">
      <Spinner size="lg" />
      <h2
        className="font-semibold"
        style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {body}
      </p>
    </Card>
  )
}
