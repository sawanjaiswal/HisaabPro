/**
 * Service Worker Update Prompt
 *
 * Shows an update prompt when a new app version is available:
 * - Mobile (<768px): Smooth bottom drawer
 * - Desktop (>=768px): Centered popup modal
 *
 * Employs HisaabPro's design system Drawer primitive, emerald tones,
 * pulse illustration icon, and clear "Update Now" and "Later" actions.
 */

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, Zap, ShieldCheck } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { useLanguage } from '@/hooks/useLanguage'
import { subscribeToSWUpdates, acceptUpdate } from '@/lib/sw-register'
import './sw-update-prompt.css'

export function SWUpdatePrompt() {
  const { t } = useLanguage()
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

  const handleDismiss = () => {
    setShow(false)
  }

  return (
    <Drawer
      open={show}
      onClose={handleDismiss}
      size="sm"
      showClose={true}
      persistent={updating}
      footer={
        <div className="sw-update-actions">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleUpdate}
            loading={updating}
            className="sw-update-confirm-btn"
          >
            <RefreshCw size={18} aria-hidden="true" className={updating ? 'animate-spin' : ''} />
            {updating ? (t.loading || 'Updating...') : (t.continueWith || 'Continue')}
          </Button>
        </div>
      }
    >
      <div className="sw-update-content">
        <div className="sw-update-illustration-wrapper">
          <div className="sw-update-illustration-ring" aria-hidden="true" />
          <div className="sw-update-illustration-core">
            <Sparkles className="sw-update-icon-sparkle" size={32} aria-hidden="true" />
          </div>
          <div className="sw-update-badge-pill" aria-hidden="true">
            <Zap size={12} />
            <span>New</span>
          </div>
        </div>

        <Heading level={3} className="sw-update-title">
          {t.update ? `${t.update} Available` : 'Update Available'}
        </Heading>

        <Text className="sw-update-description">
          A new and improved version of HisaabPro is ready. Update now to enjoy the latest features, performance improvements, and bug fixes.
        </Text>

        <div className="sw-update-highlights">
          <div className="sw-update-highlight-item">
            <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" aria-hidden="true" />
            <Text className="sw-update-highlight-text">
              Instant offline sync & data safety
            </Text>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
