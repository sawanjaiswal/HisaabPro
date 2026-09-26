/** ClinicNotesBanner — only rendered when vertical === 'clinic'.
 *
 * Reminds users that notes are not encrypted at rest yet, so PHI must not
 * be entered. Matches SCOPE §clinic-notes-no-phi and PAGE_AUDIT_CHECKLIST §A.
 */

import { Text } from '@/components/ui/Text'
import { ShieldAlert } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export function ClinicNotesBanner() {
  const { t } = useLanguage()
  return (
    <div
      role="note"
      className="flex items-start gap-3 p-3 rounded-md"
      style={{
        background: 'var(--color-warning-surface, var(--color-surface-muted))',
        border: '1px solid var(--color-warning, var(--color-border))',
      }}
    >
      <ShieldAlert size={20} aria-hidden="true" style={{ color: 'var(--color-warning, var(--color-text))' }} />
      <Text className="text-sm" style={{ color: 'var(--color-text)' }}>
        {t.clinicNotesNoPHI}
      </Text>
    </div>
  )
}
