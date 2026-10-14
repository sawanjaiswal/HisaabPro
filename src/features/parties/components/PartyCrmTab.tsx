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
import { CalendarClock, CheckCircle2, Clock, Sparkles, X, AlertCircle } from 'lucide-react'
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

  // Quick preset helper
  const applyPreset = (hoursFromNow: number) => {
    setError(null)
    const target = new Date(Date.now() + hoursFromNow * 3600 * 1000)
    // Snap to 10:00 AM if it's tomorrow or beyond
    if (hoursFromNow >= 24) {
      target.setHours(10, 0, 0, 0)
    }
    setDraftFollowUpAt(target.toISOString())
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

  const isFollowUpScheduled = Boolean(draftFollowUpAt)
  const isOverdue = draftFollowUpAt ? Date.parse(draftFollowUpAt) < Date.now() : false

  return (
    <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-gray-100)]">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-[var(--color-primary-600)]" />
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {t.crmFollowUpsTitle ?? 'Follow-ups & CRM'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isFollowUpScheduled ? (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isOverdue
                  ? 'bg-[var(--color-error-50)] text-[var(--color-error-700)]'
                  : 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
              }`}
            >
              {isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
              {isOverdue ? 'Overdue Follow-up' : 'Scheduled'}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)]">None Scheduled</span>
          )}

          {/* Compact Save Button only appears when follow-up has changed */}
          {isDirty && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSave}
              disabled={isSaving || error !== null}
              aria-label={t.save}
              className="h-7 px-3 text-xs font-semibold animate-in fade-in"
            >
              <CheckCircle2 size={13} aria-hidden="true" className="mr-1" />
              <span>{isSaving ? t.saving : t.save}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Presets Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1">
            <Sparkles size={12} className="text-[var(--color-primary-600)]" />
            Quick Presets
          </span>
          {draftFollowUpAt && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onChange(null)}
              className="h-auto p-0 text-[11px] font-medium text-[var(--color-error-600)] hover:underline flex items-center gap-0.5 hover:bg-transparent"
            >
              <X size={11} /> Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => applyPreset(4)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] text-[var(--text-primary)] transition-all h-auto"
          >
            Today (+4 hrs)
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => applyPreset(24)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] text-[var(--text-primary)] transition-all h-auto"
          >
            Tomorrow 10 AM
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => applyPreset(72)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] text-[var(--text-primary)] transition-all h-auto"
          >
            In 3 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => applyPreset(168)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] text-[var(--text-primary)] transition-all h-auto"
          >
            Next Week
          </Button>
        </div>
      </div>

      {/* Date-time picker */}
      <FollowUpDatePicker
        value={draftFollowUpAt}
        onChange={onChange}
        error={error}
        disabled={isSaving}
      />

      {/* Activity Status Card */}
      <div className="p-3 rounded-lg border border-[var(--color-gray-100)] bg-[var(--color-gray-50)] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--text-secondary)]">{t.crmLastContacted}</span>
          <span className="font-bold text-[var(--text-primary)]">
            {party.lastContactedAt ? formatRelativeTime(party.lastContactedAt) : t.crmNeverContacted}
          </span>
        </div>
        {party.loyaltyOptOut && (
          <div className="text-[11px] text-[var(--color-error-600)] font-medium pt-1 border-t border-[var(--color-gray-200)] flex items-center gap-1">
            <AlertCircle size={12} />
            Customer opted out from marketing SMS / reminders
          </div>
        )}
      </div>
    </div>
  )
}
