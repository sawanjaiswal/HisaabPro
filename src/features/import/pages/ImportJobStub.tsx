/**
 * Phase 7 Slice 7.1A FE.1 — Stub page mounted at /imports/:jobId.
 * Replaced by FE.2 (Preview + dedup review). Exists only so FE.1's
 * post-upload navigation has a valid landing route.
 */

import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'

export default function ImportJobStubPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { t } = useLanguage()
  const tx = t as unknown as Record<string, string>

  return (
    <AppShell>
      <Header title={tx.importPageTitle ?? 'Import data'} backTo={ROUTES.IMPORTS} />
      <PageContainer variant="form" className="space-y-4">
        <Card variant="default" className="p-4 space-y-2">
          <h1
            className="font-semibold"
            style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
          >
            {tx.importJobStubTitle ?? 'Import job created'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-md)' }}>
            {tx.importJobStubBody ?? 'The preview page is on the way. Job:'}
          </p>
          <code
            className="break-all"
            style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--color-text-primary)',
              background: 'var(--color-surface-alt)',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              display: 'block',
            }}
          >
            {jobId}
          </code>
        </Card>
      </PageContainer>
    </AppShell>
  )
}
