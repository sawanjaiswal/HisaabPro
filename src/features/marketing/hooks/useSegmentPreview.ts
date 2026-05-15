/** useSegmentPreview — debounced segment count fetch */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { previewSegment } from '../marketing.service'
import { SEGMENT_PREVIEW_DEBOUNCE_MS } from '../marketing.constants'
import { isTooLarge } from '../marketing.utils'
import type { SegmentFilter, SegmentPreviewResult } from '../marketing.types'

interface UseSegmentPreviewResult {
  preview: SegmentPreviewResult | null
  loading: boolean
  error: string | null
  tooLarge: boolean
  refresh: () => void
}

export function useSegmentPreview(filter: SegmentFilter): UseSegmentPreviewResult {
  const { t } = useLanguage()
  const [preview, setPreview] = useState<SegmentPreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filterRef = useRef(filter)
  filterRef.current = filter
  const errorMsg = t.marketingSegmentPreviewError

  const run = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)

    previewSegment(filterRef.current, ctrl.signal)
      .then((res) => {
        setPreview(res)
        setError(null)
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'AbortError') return
        setError(errorMsg)
      })
      .finally(() => setLoading(false))
  }, [errorMsg])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(run, SEGMENT_PREVIEW_DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [
    filter.tags?.join(','),
    filter.cityContains,
    filter.inactiveDays,
    filter.outstandingGtePaise,
    filter.birthdayThisWeek,
    filter.partyType,
    run,
  ])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  return {
    preview,
    loading,
    error,
    tooLarge: preview != null ? isTooLarge(preview.count) : false,
    refresh: run,
  }
}
