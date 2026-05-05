/** BusinessTypePage — change the active business's vertical.
 *
 * Lets the owner switch between vertical templates (retail / services /
 * restaurant / bakery / …). Hidden menu items appear or disappear based on
 * the new type. Uses the same VerticalPicker as onboarding for visual
 * consistency.
 */

import { useState } from 'react'
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

export default function BusinessTypePage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const { user, businesses } = useAuth()
  const currentVertical = useVertical()

  const [pending, setPending] = useState<BusinessType>(currentVertical.type)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const businessId = user?.businessId
  const dirty = pending !== currentVertical.type

  const handleSubmit = () => {
    if (!dirty || !businessId) return
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!businessId) return
    setSaving(true)
    setConfirmOpen(false)
    try {
      await api(`/businesses/${businessId}`, {
        method: 'PUT',
        body: JSON.stringify({ businessType: pending }),
        entityType: 'business',
        entityLabel: businesses.find((b) => b.id === businessId)?.name ?? 'Business',
      })
      toast.success(t.changeBusinessType)
      // Reload so /me + cached businesses refresh; vertical-driven nav updates everywhere.
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
