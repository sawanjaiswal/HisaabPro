/** Bottom drawer form to configure a new recurring schedule for a template doc. */
import React, { useState, useCallback, useRef } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '@/lib/format'
import { FREQUENCY_LABELS } from '../recurring.constants'
import type { RecurringFrequency, CreateRecurringInput } from '../recurring.types'

interface RecurringCreateDrawerProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateRecurringInput) => Promise<void>
}

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]

function todayISO(): string {
  return toLocalISODate(new Date())
}

export const RecurringCreateDrawer: React.FC<RecurringCreateDrawerProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const { t } = useLanguage()
  const dayNames = [t.daySun, t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat]
  const [templateDocumentId, setTemplateDocumentId] = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [autoSend, setAutoSend] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitGuard = useRef(false)

  const handleClose = useCallback(() => {
    if (submitting) return
    setTemplateDocumentId('')
    setFrequency('MONTHLY')
    setStartDate(todayISO())
    setEndDate('')
    setDayOfMonth('1')
    setDayOfWeek('1')
    setAutoSend(false)
    setError(null)
    onClose()
  }, [submitting, onClose])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (submitGuard.current) return
      if (!templateDocumentId.trim()) {
        setError(t.templateDocRequired)
        return
      }

      submitGuard.current = true
      setSubmitting(true)
      setError(null)

      const input: CreateRecurringInput = {
        templateDocumentId: templateDocumentId.trim(),
        frequency,
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(frequency === 'WEEKLY'
          ? { dayOfWeek: Number(dayOfWeek) }
          : { dayOfMonth: Number(dayOfMonth) }),
        autoSend,
      }

      try {
        await onSubmit(input)
        handleClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.failedCreateSchedule)
      } finally {
        setSubmitting(false)
        submitGuard.current = false
      }
    },
    [
      templateDocumentId,
      frequency,
      startDate,
      endDate,
      dayOfMonth,
      dayOfWeek,
      autoSend,
      onSubmit,
      handleClose,
    ]
  )

  const showDayOfMonth = frequency !== 'WEEKLY'

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={t.newRecurringSchedule}
      persistent={submitting}
      footer={
        <button
          type="submit"
          form="recurring-create-form"
          className="recurring-drawer__submit-btn py-0"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? t.creatingSchedule : t.createScheduleBtn}
        </button>
      }
    >
      <form
        id="recurring-create-form"
        className="recurring-drawer__form py-0"
        onSubmit={handleSubmit}
        noValidate
      >
        {error && (
          <p className="recurring-drawer__error py-0" role="alert">
            {error}
          </p>
        )}

        <div className="recurring-drawer__field py-0">
          <label htmlFor="rcd-template" className="recurring-drawer__label py-0">
            {t.templateDocId}
          </label>
          <input
            id="rcd-template"
            type="text"
            className="recurring-drawer__input py-0"
            value={templateDocumentId}
            onChange={(e) => setTemplateDocumentId(e.target.value)}
            placeholder={t.templateDocPlaceholder}
            required
            autoComplete="off"
          />
        </div>

        <div className="recurring-drawer__field py-0">
          <label htmlFor="rcd-frequency" className="recurring-drawer__label py-0">
            {t.frequencyLabel}
          </label>
          <select
            id="rcd-frequency"
            className="recurring-drawer__select py-0"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        {showDayOfMonth && (
          <div className="recurring-drawer__field py-0">
            <label htmlFor="rcd-dom" className="recurring-drawer__label py-0">
              {t.dayOfMonthLabel}
            </label>
            <input
              id="rcd-dom"
              type="number"
              className="recurring-drawer__input py-0"
              value={dayOfMonth}
              min={1}
              max={28}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          </div>
        )}

        {!showDayOfMonth && (
          <div className="recurring-drawer__field py-0">
            <label htmlFor="rcd-dow" className="recurring-drawer__label py-0">
              {t.dayOfWeekLabel}
            </label>
            <select
              id="rcd-dow"
              className="recurring-drawer__select py-0"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
            >
              {dayNames.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="recurring-drawer__row py-0">
          <div className="recurring-drawer__field py-0">
            <label htmlFor="rcd-start" className="recurring-drawer__label py-0">
              {t.startDateLabel}
            </label>
            <input
              id="rcd-start"
              type="date"
              className="recurring-drawer__input py-0"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="recurring-drawer__field py-0">
            <label htmlFor="rcd-end" className="recurring-drawer__label py-0">
              {t.endDateOptional}
            </label>
            <input
              id="rcd-end"
              type="date"
              className="recurring-drawer__input py-0"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <label className="recurring-drawer__toggle py-0">
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            aria-label={t.autoSendLabel}
          />
          <span className="recurring-drawer__toggle-label py-0">
            {t.autoSendLabel}
          </span>
        </label>
      </form>
    </Drawer>
  )
}
