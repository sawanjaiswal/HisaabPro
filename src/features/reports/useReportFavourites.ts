/** Reports hub — favourite report categories, persisted in IndexedDB.
 *
 * Stored via the shared prefs store (never localStorage — OFFLINE_RULES #4).
 * The hook hydrates asynchronously; `hydrated` gates the skeleton so the
 * favourites section never flashes "empty" before the read resolves.
 */

import { useCallback, useEffect, useState } from 'react'
import { getPref, setPref } from '@/lib/prefs-store'
import { REPORT_CATEGORIES } from './report.categories'
import type { ReportCategory } from './report.types'

const PREF_KEY = 'reports:favourites'

interface UseReportFavourites {
  /** Favourite category ids, in the order the hub lists them */
  favouriteIds: string[]
  /** Resolved categories for the favourites section */
  favourites: ReportCategory[]
  /** False until the IndexedDB read resolves */
  hydrated: boolean
  isFavourite: (id: string) => boolean
  toggleFavourite: (id: string) => void
}

export function useReportFavourites(): UseReportFavourites {
  const [favouriteIds, setFavouriteIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false

    void getPref<string[]>(PREF_KEY, []).then((stored) => {
      if (cancelled) return
      // Drop ids for categories that no longer exist (renamed/removed report)
      const known = stored.filter((id) => REPORT_CATEGORIES.some((c) => c.id === id))
      setFavouriteIds(known)
      setHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const toggleFavourite = useCallback((id: string) => {
    setFavouriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      void setPref(PREF_KEY, next)
      return next
    })
  }, [])

  const isFavourite = useCallback(
    (id: string) => favouriteIds.includes(id),
    [favouriteIds],
  )

  // Keep hub order rather than tap order — the grid is the mental model
  const favourites = REPORT_CATEGORIES.filter((c) => favouriteIds.includes(c.id))

  return { favouriteIds, favourites, hydrated, isFavourite, toggleFavourite }
}
