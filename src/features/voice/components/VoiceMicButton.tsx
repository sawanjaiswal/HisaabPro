/** VoiceMicButton — mic capture control + live/editable transcript + typed fallback. */

import { Mic, MicOff, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { SpeechStatus } from '../voice.types'
import { Textarea } from '@/components/ui/Textarea'

interface Props {
  status: SpeechStatus
  isSupported: boolean
  transcript: string
  onStart: () => void
  onStop: () => void
  onChangeText: (text: string) => void
  onContinue: () => void
}

export function VoiceMicButton({
  status, isSupported, transcript, onStart, onStop, onChangeText, onContinue,
}: Props) {
  const { t } = useLanguage()
  const listening = status === 'listening'

  return (
    <div className="voice-capture">
      {isSupported ? (
        <button
          type="button"
          className={`voice-mic${listening ? ' voice-mic--active' : ''}`}
          aria-label={listening ? t.voiceStop : t.voiceStart}
          aria-pressed={listening}
          onClick={listening ? onStop : onStart}
        >
          {listening ? <Square size={28} aria-hidden="true" /> : <Mic size={28} aria-hidden="true" />}
        </button>
      ) : (
        <div className="voice-mic voice-mic--disabled" aria-hidden="true"><MicOff size={28} /></div>
      )}

      <p className="voice-capture__hint">
        {!isSupported ? t.voiceUnsupported : listening ? t.voiceListening : t.voiceTapToSpeak}
      </p>
      {status === 'denied' && <p className="voice-capture__error" role="alert">{t.voiceMicDenied}</p>}
      {status === 'error' && <p className="voice-capture__error" role="alert">{t.voiceMicError}</p>}

      <label className="voice-preview__label" htmlFor="voiceTranscript">{t.voiceTranscriptLabel}</label>
      <Textarea
        id="voiceTranscript"
        className="voice-capture__textarea"
        rows={3}
        value={transcript}
        placeholder={t.voiceTranscriptPlaceholder}
        onChange={(e) => onChangeText(e.target.value)}
      />

      <Button variant="primary" size="md" onClick={onContinue} disabled={!transcript.trim()}>
        {t.voiceContinue}
      </Button>
    </div>
  )
}
