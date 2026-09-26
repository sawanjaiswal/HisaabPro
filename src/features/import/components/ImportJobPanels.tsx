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

import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/feedback/Spinner'
import { Heading } from '@/components/ui/Heading'

interface PanelProps {
  title: string
  body: string
}

export function StubPanel({ title, body }: PanelProps) {
  return (
    <Card variant="default" className="p-4 space-y-2">
      <Heading level={2}
        className="font-semibold text-base text-[var(--text-primary)] font-semibold"
        
      >
        {title}
      </Heading>
      <Text className="text-sm text-[var(--text-secondary)]">
        {body}
      </Text>
    </Card>
  )
}

export function CommittingPanel({ title, body }: PanelProps) {
  return (
    <Card variant="default" className="p-6 flex flex-col items-center text-center gap-3">
      <Spinner size="lg" />
      <Heading level={2}
        className="font-semibold text-base text-[var(--text-primary)] font-semibold"
        
      >
        {title}
      </Heading>
      <Text className="text-sm text-[var(--text-secondary)]">
        {body}
      </Text>
    </Card>
  )
}
