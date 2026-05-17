/**
 * Commission #128 — Rules settings page (route: /settings/commission).
 *
 * Shows the rule list with a header CTA to create a new rule. The form
 * opens in a side <Drawer> so the user keeps the list visible. Edit
 * mode reuses the same drawer pre-seeded with the rule DTO.
 *
 * 4 UI states delegated to <CommissionRuleList>.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { CommissionRuleForm } from '../components/CommissionRuleForm'
import { CommissionRuleList } from '../components/CommissionRuleList'
import type { CommissionRuleDTO } from '../commission.types'
import '@/styles/components.commission.css'

export default function CommissionSettingsPage() {
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionRuleDTO | null>(null)

  const openCreate = () => {
    setEditing(null)
    setDrawerOpen(true)
  }
  const openEdit = (rule: CommissionRuleDTO) => {
    setEditing(rule)
    setDrawerOpen(true)
  }
  const close = () => {
    setDrawerOpen(false)
    setEditing(null)
  }

  return (
    <AppShell>
      <Header
        title={t.commissionSettingsTitle}
        backTo={ROUTES.SETTINGS}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={openCreate}
            aria-label={t.commissionRuleCreateButton}
          >
            <Plus size={16} aria-hidden="true" />
            {t.commissionRuleCreateButton}
          </Button>
        }
      />

      <PageContainer variant="list">
        <p className="commission-settings__description">
          {t.commissionSettingsDescription}
        </p>
        <CommissionRuleList onCreate={openCreate} onEdit={openEdit} />
      </PageContainer>

      <Drawer
        open={drawerOpen}
        onClose={close}
        title={editing ? t.commissionRuleEditDrawerTitle : t.commissionRuleCreateDrawerTitle}
        size="lg"
      >
        <CommissionRuleForm rule={editing} onDone={close} />
      </Drawer>
    </AppShell>
  )
}
