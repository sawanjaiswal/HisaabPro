/**
 * CRM (#127) — PartyCrmTab.
 *
 * Surfaces the CRM block on PartyDetailPage. Hosts:
 *   - FollowUpDatePicker (date + clear)
 *   - "Save follow-up" action
 *   - Last contacted at (read-only — server auto-updates on share/reminder)
 *
 * Tags editing lives in the existing PartyFormBasic flow — we don't dupe it
 * here. The CRM tab is for *time-based* touch state.
 *
 * Optimistic UI: while the mutation is in-flight (or queued offline), we
 * show the picked value so the user gets immediate feedback. Server PATCH
 * returns the canonical value; on success we toast + invalidate.
 *
 * 4 UI states: this tab is render-only (no fetch — data is on `party`),
 * so loading/error/empty come from PartyDetailPage's outer query.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { invalidatePartyLists } from '@/features/parties/party-cache'
import { formatRelativeTime } from '@/lib/format'
import { FollowUpDatePicker } from '@/features/crm/components/FollowUpDatePicker'
import { patchPartyCrm } from '@/features/crm/api/crm.service'
import type { PartyDetail } from '../party.types'
import '@/styles/components.crm.css'

interface PartyCrmTabProps {
  party: PartyDetail
  onPatched: () => void
}

export function PartyCrmTab({ party, onPatched }: PartyCrmTabProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [draftFollowUpAt, setDraftFollowUpAt] = useState<string | null>(party.followUpAt ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = (party.followUpAt ?? null) !== draftFollowUpAt

  const onChange = (next: string | null) => {
    setError(null)
    if (next) {
      const ts = Date.parse(next)
      if (Number.isFinite(ts) && ts <= Date.now()) {
        setError(t.crmFollowUpMustBeFuture)
        return
      }
    }
    setDraftFollowUpAt(next)
  }

  const onSave = async () => {
    setIsSaving(true)
    try {
      await patchPartyCrm(party.id, { followUpAt: draftFollowUpAt }, party.name)
      toast.success(navigator.onLine ? t.crmSaved : t.crmSavedQueuedOffline)
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all() })
      invalidatePartyLists(queryClient)
      onPatched()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_FOLLOWUP_PAST') {
        setError(t.crmFollowUpMustBeFuture)
      } else {
        const msg = err instanceof Error ? err.message : t.somethingWentWrong
        toast.error(msg)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="party-crm-tab">
      <FollowUpDatePicker
        value={draftFollowUpAt}
        onChange={onChange}
        error={error}
        disabled={isSaving}
      />
      <div className="party-crm-tab__last-contact" aria-live="polite">
        <span className="party-crm-tab__last-contact-label">{t.crmLastContacted}</span>
        <span className="party-crm-tab__last-contact-value">
          {party.lastContactedAt ? formatRelativeTime(party.lastContactedAt) : t.crmNeverContacted}
        </span>
      </div>
      <div className="party-crm-tab__actions">
        <Button
          type="button"
          variant="primary" size="md"
          onClick={onSave}
          disabled={!isDirty || isSaving || error !== null}
          aria-label={t.save}
        >
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{isSaving ? t.saving : t.save}</span>
        </Button>
      </div>
    </div>
  )
}
