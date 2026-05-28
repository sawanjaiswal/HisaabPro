/** Voice Entry — speak (or type) a money entry, confirm the parse, save.
 *
 * 4 UI states: capture (idle/listening), preview (parsed draft), saving,
 * and the unsupported/denied fallback handled inside VoiceMicButton.
 * Saves directly via the expense / other-income services — no drawer detour.
 */

import { useCallback, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { createExpense } from '@/features/expenses/expense.service'
import { createOtherIncome } from '@/features/other-income/other-income.service'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { parseVoiceEntry } from './voice.parser'
import { VoiceMicButton } from './components/VoiceMicButton'
import { ParsedEntryPreview } from './components/ParsedEntryPreview'
import type { ParsedVoiceEntry } from './voice.types'
import './voice.css'

export default function VoiceEntryPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const { status, transcript, isSupported, start, stop, setTranscript } = useSpeechRecognition('en-IN')
  const [draft, setDraft] = useState<ParsedVoiceEntry | null>(null)
  const [saving, setSaving] = useState(false)

  const handleContinue = useCallback(() => {
    if (!transcript.trim()) return
    setDraft(parseVoiceEntry(transcript))
  }, [transcript])

  const patchDraft = useCallback((patch: Partial<ParsedVoiceEntry>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }, [])

  const handleCancel = useCallback(() => {
    setDraft(null)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!draft || draft.amountPaise == null || saving) return
    setSaving(true)
    try {
      if (draft.intent === 'expense') {
        await createExpense({
          amount: draft.amountPaise,
          date: draft.dateISO,
          paymentMode: draft.paymentMode,
          notes: draft.notes || undefined,
        })
      } else {
        await createOtherIncome({
          amount: draft.amountPaise,
          date: draft.dateISO,
          paymentMode: draft.paymentMode,
          category: draft.category || undefined,
          notes: draft.notes || undefined,
        })
      }
      toast.success(
        navigator.onLine
          ? (draft.intent === 'expense' ? t.expenseRecorded : t.incomeRecorded)
          : t.voiceSavedOffline,
      )
      setDraft(null)
      setTranscript('')
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : t.voiceSaveFailed)
    } finally {
      setSaving(false)
    }
  }, [draft, saving, toast, t, setTranscript])

  return (
    <AppShell>
      <Header title={t.voiceEntryTitle} backTo={ROUTES.DASHBOARD} />
      <PageContainer variant="form" className="space-y-6">
        <Card className="voice-card">
          {draft ? (
            <ParsedEntryPreview
              draft={draft}
              onChange={patchDraft}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              saving={saving}
            />
          ) : (
            <VoiceMicButton
              status={status}
              isSupported={isSupported}
              transcript={transcript}
              onStart={start}
              onStop={stop}
              onChangeText={setTranscript}
              onContinue={handleContinue}
            />
          )}
        </Card>

        <p className="voice-examples">{t.voiceExamples}</p>
      </PageContainer>
    </AppShell>
  )
}
