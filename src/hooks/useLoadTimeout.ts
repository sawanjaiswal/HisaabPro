/** useLoadTimeout — flips true after `ms` of continuous loading.
 *
 * Used to escape "stuck skeleton" states. While `isLoading` is true,
 * a timer runs; if it fires before loading flips to false, callers can
 * show a retry CTA instead of an indefinite spinner.
 */

import { useEffect, useState } from 'react'

export function useLoadTimeout(isLoading: boolean, ms = 8000): boolean {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false)
      return
    }
    const id = window.setTimeout(() => setTimedOut(true), ms)
    return () => window.clearTimeout(id)
  }, [isLoading, ms])

  return timedOut
}
