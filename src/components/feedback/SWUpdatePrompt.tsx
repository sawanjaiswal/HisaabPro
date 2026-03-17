/**
 * Service Worker Update Prompt
 *
 * Shows a toast-like prompt when a new app version is available.
 * User can tap "Update" to reload with the new SW.
 */

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { subscribeToSWUpdates, acceptUpdate } from '@/lib/sw-register'
import './sw-update-prompt.css'

export function SWUpdatePrompt() {
  const [show, setShow] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    return subscribeToSWUpdates((needRefresh) => {
      if (needRefresh) setShow(true)
    })
  }, [])

  if (!show) return null

  async function handleUpdate() {
    setUpdating(true)
    await acceptUpdate()
  }

  return (
    <div className="sw-update-prompt" role="alert">
      <p className="sw-update-text">A new version is available</p>
      <button
        className="sw-update-btn"
        onClick={handleUpdate}
        disabled={updating}
        aria-busy={updating}
      >
        <RefreshCw size={14} aria-hidden="true" />
        {updating ? 'Updating...' : 'Update'}
      </button>
    </div>
  )
}
