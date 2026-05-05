/** BusinessTypePage — change the active business's vertical.
 *
 * Lets the owner switch between vertical templates (retail / services /
 * restaurant / bakery / …). Hidden menu items appear or disappear based on
 * the new type. Optionally re-applies recommended InventorySetting defaults
 * for the chosen vertical.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useVertical } from '@/hooks/useVertical'
import { ROUTES } from '@/config/routes.config'
import { api } from '@/lib/api'
import { VerticalPicker } from '@/features/onboarding/components/VerticalPicker'
import {
  type BusinessType, getVerticalProfile, VERTICAL_PROFILES,
} from '@/config/verticals.config'

interface DefaultsPreview {
  applied: boolean
  summary: string[]
}

export default function BusinessTypePage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const { user, businesses } = useAuth()
  const currentVertical = useVertical()

  const [pending, setPending] = useState<BusinessType>(currentVertical.type)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applyDefaults, setApplyDefaults] = useState(true)
  const [preview, setPreview] = useState<DefaultsPreview>({ applied: false, summary: [] })

  const businessId = user?.businessId
  const dirty = pending !== currentVertical.type

  // Fetch defaults preview when pending changes
  useEffect(() => {
    if (!businessId) return
    let cancelled = false
    api<DefaultsPreview>(`/businesses/${businessId}/vertical-defaults?type=${pending}`)
      .then((r) => { if (!cancelled) setPreview(r) })
      .catch(() => { if (!cancelled) setPreview({ applied: false, summary: [] }) })
    return () => { cancelled = true }
  }, [businessId, pending])

  const handleSubmit = () => {
    if (!dirty || !businessId) return
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!businessId) return
    setSaving(true)
    setConfirmOpen(false)
    const businessLabel = businesses.find((b) => b.id === businessId)?.name ?? 'Business'
    try {
      await api(`/businesses/${businessId}`, {
        method: 'PUT',
        body: JSON.stringify({ businessType: pending }),
        entityType: 'business',
        entityLabel: businessLabel,
      })
      if (applyDefaults && preview.applied) {
        try {
          await api(`/businesses/${businessId}/apply-vertical-defaults`, {
            method: 'POST',
            entityType: 'business',
            entityLabel: businessLabel,
          })
          toast.success(t.verticalDefaultsApplied)
        } catch {
          // Type switched but defaults failed — still continue. Non-fatal.
        }
      } else {
        toast.success(t.changeBusinessType)
      }
      window.location.assign(ROUTES.DASHBOARD)
    } catch {
      toast.error(t.checkConnectionRetry)
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <Header title={t.changeBusinessType} backTo={ROUTES.SETTINGS} />
      <PageContainer className="space-y-6">
        <div className="space-y-6">
          <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--fs-sm)' }}>
            {t.pickBusinessTypeDesc}
          </p>

          <VerticalPicker
            value={pending}
            onChange={setPending}
            disabled={saving}
          />

          {dirty && preview.applied && preview.summary.length > 0 && (
            <div style={{
              padding: 'var(--space-3)',
              background: 'var(--color-info-50, var(--color-gray-50))',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-gray-200)',
            }}>
              <p style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                color: 'var(--color-gray-800)',
                marginBottom: 'var(--space-2)',
              }}>{t.verticalDefaultsTitle}</p>
              <ul style={{
                fontSize: 'var(--fs-sm)',
                color: 'var(--color-gray-700)',
                lineHeight: 1.6,
                paddingLeft: 'var(--space-4)',
                listStyle: 'disc',
              }}>
                {preview.summary.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                marginTop: 'var(--space-3)', cursor: 'pointer',
                fontSize: 'var(--fs-sm)', color: 'var(--color-gray-800)',
              }}>
                <input
                  type="checkbox"
                  checked={applyDefaults}
                  onChange={(e) => setApplyDefaults(e.target.checked)}
                  disabled={saving}
                />
                {t.applyVerticalDefaults}
              </label>
            </div>
          )}

          {dirty && (
            <p style={{
              padding: 'var(--space-3)',
              background: 'var(--color-warning-50)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-gray-800)',
              fontSize: 'var(--fs-sm)',
              lineHeight: 1.5,
            }}>
              {t.switchBusinessTypeWarn}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => navigate(ROUTES.SETTINGS)}
              disabled={saving}
              style={{ flex: 1 }}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              disabled={!dirty || saving}
              loading={saving}
              style={{ flex: 1 }}
            >
              {t.switchBusinessTypeBtn}
            </Button>
          </div>
        </div>
      </PageContainer>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={t.switchBusinessTypeTitle}
        description={`${t.switchBusinessTypeWarn}\n\n${
          t[getVerticalProfile(currentVertical.type).labelKey]
        } → ${t[VERTICAL_PROFILES[pending].labelKey]}`}
        confirmLabel={t.switchBusinessTypeBtn}
      />
    </AppShell>
  )
}
