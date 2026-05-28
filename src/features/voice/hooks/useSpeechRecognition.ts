/** useSpeechRecognition — thin Web Speech API wrapper.
 *
 * Browser-only. Degrades gracefully: when the API is missing (most Android
 * WebViews, older browsers), `isSupported` is false and the page shows a
 * typed-input fallback instead. Live mic capture cannot be unit-tested
 * without a real device — the pure parser carries the test coverage.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeechStatus } from '../voice.types'

interface MinimalRecognitionEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
interface MinimalRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: MinimalRecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => MinimalRecognition

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition(lang = 'en-IN') {
  const ctorRef = useRef<RecognitionCtor | null>(null)
  if (ctorRef.current === null) ctorRef.current = getCtor()
  const isSupported = ctorRef.current !== null

  const recognitionRef = useRef<MinimalRecognition | null>(null)
  const [status, setStatus] = useState<SpeechStatus>(isSupported ? 'idle' : 'unsupported')
  const [transcript, setTranscript] = useState('')

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = ctorRef.current
    if (!Ctor) { setStatus('unsupported'); return }
    setTranscript('')
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript
      }
      setTranscript(text)
    }
    rec.onerror = (e) => {
      setStatus(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : 'error')
    }
    rec.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s))
    }
    recognitionRef.current = rec
    setStatus('listening')
    rec.start()
  }, [lang])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { status, transcript, isSupported, start, stop, setTranscript }
}
