/** Settings — Document Custom Fields page (#134) */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useDocumentCustomFields } from './useDocumentCustomFields'
import { DocumentCustomFieldRow } from './components/DocumentCustomFieldRow'
import { DocumentCustomFieldDrawer } from './components/DocumentCustomFieldDrawer'
import type { DocumentCustomFieldDef } from './document-custom-fields.service'
import './settings-toggle.css'
import './settings.css'

export default function DocumentCustomFieldsPage() {
  const { t } = useLanguage()
  const { fields, status, refresh, create, update, remove, isMutating } = useDocumentCustomFields()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentCustomFieldDef | null>(null)
  const [deleting, setDeleting] = useState<DocumentCustomFieldDef | null>(null)

  const openCreate = () => { setEditing(null); setDrawerOpen(true) }
  const openEdit = (f: DocumentCustomFieldDef) => { setEditing(f); setDrawerOpen(true) }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await remove(deleting.id)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <AppShell>
      <Header
        title={t.documentCustomFieldsTitle}
        backTo={ROUTES.SETTINGS}
        actions={
          <Button variant="none"
            type="button"
            onClick={openCreate}
            aria-label={t.addCustomField}
            className="p-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-gray-100)] transition-colors"
          >
            <Plus className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
          </Button>
        }
      />
      <PageContainer className="stagger-enter space-y-6">
        <p className="text-[var(--fs-sm)]" style={{ color: 'var(--text-secondary)' }}>
          {t.documentCustomFieldsSubtitle}
        </p>

        {status === 'loading' && (
          <div aria-busy="true" aria-label={t.loading}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ marginBottom: 'var(--space-3)' }}>
                <Skeleton height="4rem" borderRadius="var(--radius-lg)" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadSettings}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && fields.length === 0 && (
          <EmptyState
            title={t.noDocumentCustomFields}
            description={t.noDocumentCustomFieldsDesc}
            action={
              <Button variant="primary" onClick={openCreate}>
                {t.addCustomField}
              </Button>
            }
          />
        )}

        {status === 'success' && fields.length > 0 && (
          <div className="settings-group">
            {fields.map((field) => (
              <DocumentCustomFieldRow
                key={field.id}
                field={field}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            ))}
          </div>
        )}
      </PageContainer>

      <DocumentCustomFieldDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={editing}
        onCreate={create}
        onUpdate={update}
        saving={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={t.deleteCustomField}
        description={deleting ? `${t.deleteCustomFieldConfirm} "${deleting.name}"?` : ''}
        confirmLabel={t.deleteCustomField}
        isLoading={isMutating}
      />
    </AppShell>
  )
}
