/**
 * Phase 7 Slice 7.1A FE.1 — Import upload page.
 *
 * Idle state:    pick format -> pick file -> submit
 * Uploading:     submit button shows loading, dropzone disabled
 * Success:       toast + navigate('/imports/:jobId')
 * Error:         toast + inline error message
 *
 * Gated client-side by `VITE_FEATURE_DATA_IMPORT`. Server gates again
 * via requireFeature('DATA_IMPORT') — this flag only hides the UI.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { EntityPicker } from '../components/EntityPicker'
import { FormatPicker } from '../components/FormatPicker'
import { FileDropzone } from '../components/FileDropzone'
import { useImportUpload } from '../hooks/useImportUpload'
import { validateUpload, type FileValidationCode } from '../utils/file-validation'
import { stashCommitToken } from '../utils/commit-token-store'
import type { ImportEntity, ImportFormat } from '../types/import.types'

function featureEnabled(): boolean {
  // Vite-injected env var; absent in tests / non-import builds.
  const v = import.meta.env.VITE_FEATURE_DATA_IMPORT
  return v === 'true' || v === true || v === '1'
}

function importJobPath(jobId: string): string {
  // Routes are added incrementally — fall back to a deep link
  // accepted by the BE so FE.2 can wire the real route later.
  const tpl = (ROUTES as Record<string, string | undefined>).IMPORT_JOB_DETAIL
  if (tpl) return tpl.replace(':jobId', encodeURIComponent(jobId))
  return `/imports/${encodeURIComponent(jobId)}`
}

export default function ImportUploadPage() {
  const { t } = useLanguage()
  const tx = t as unknown as Record<string, string>
  const navigate = useNavigate()
  const toast = useToast()

  const [entity, setEntity] = useState<ImportEntity | null>(null)
  const [format, setFormat] = useState<ImportFormat | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [validationCode, setValidationCode] = useState<FileValidationCode | null>(null)

  const enabled = featureEnabled()

  const errorMessage = useMemo<string | null>(() => {
    if (!validationCode || validationCode === 'OK') return null
    return tx[`importValidation_${validationCode}`] ?? tx.importValidationGeneric ?? 'Please pick a valid file.'
  }, [validationCode, tx])

  const upload = useImportUpload({
    onSuccess: (res) => {
      // Stash commit token for ImportJobPage → useImportCommit (FE.5).
      // BE does not echo the token on GET, so this is the only carrier
      // between upload and commit. sessionStorage clears on tab close.
      stashCommitToken(res.jobId, res.commitToken)
      toast.success(tx.importUploadSuccess ?? 'Upload received')
      navigate(importJobPath(res.jobId))
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : (tx.importUploadFailed ?? 'Upload failed')
      toast.error(msg)
    },
  })

  const canSubmit = !!file && !!format && !!entity && !upload.isUploading

  const handleSubmit = () => {
    const result = validateUpload(file, format)
    setValidationCode(result.code)
    if (!result.ok || !file || !format || !entity) return
    upload.submit({ file, format, entity })
  }

  // Disabled feature → render a stub so the route is mountable
  if (!enabled) {
    return (
      <AppShell>
        <Header title={tx.importPageTitle ?? 'Import data'} backTo={ROUTES.MORE} />
        <PageContainer variant="form" className="space-y-6">
          <Card variant="default" className="p-4">
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {tx.importFeatureDisabled ?? 'Data import is not available yet for this business.'}
            </p>
          </Card>
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={tx.importPageTitle ?? 'Import data'} backTo={ROUTES.PARTIES} />
      <PageContainer variant="form" className="space-y-6">
        <div className="space-y-2">
          <h1
            className="font-semibold"
            style={{ fontSize: 'var(--fs-xl)', color: 'var(--color-text-primary)' }}
          >
            {entity === 'payments'
              ? (tx.importPayments ?? 'Import payments')
              : entity === 'invoice'
                ? (tx.importInvoices ?? 'Import invoices')
                : entity === 'product'
                  ? (tx.importProducts ?? 'Import products')
                  : (tx.importParties ?? 'Import parties')}
          </h1>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-secondary)' }}>
            {entity === 'payments'
              ? (tx.importIntroPayments ??
                'Bring receipts and payments in from Tally, Vyapar, Busy, or a generic CSV.')
              : entity === 'invoice'
                ? (tx.importIntroInvoice ??
                  'Bring invoices in from Tally, Vyapar, Busy, or a generic CSV.')
                : entity === 'product'
                  ? (tx.importIntroProduct ??
                    'Bring products in from Tally, Vyapar, Busy, or a generic CSV.')
                  : (tx.importIntro ?? 'Bring parties in from Tally, Vyapar, Busy, or a generic CSV.')}
          </p>
        </div>

        <section className="space-y-3" aria-labelledby="import-entity-heading">
          <h2
            id="import-entity-heading"
            className="font-semibold"
            style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)' }}
          >
            {tx.importStepEntity ?? '1. What are you importing?'}
          </h2>
          <EntityPicker value={entity} onChange={setEntity} disabled={upload.isUploading} />
        </section>

        <section className="space-y-3" aria-labelledby="import-format-heading">
          <h2
            id="import-format-heading"
            className="font-semibold"
            style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)' }}
          >
            {tx.importStepFormat ?? '2. Choose source'}
          </h2>
          <FormatPicker value={format} onChange={setFormat} disabled={upload.isUploading || !entity} />
        </section>

        <section className="space-y-3" aria-labelledby="import-file-heading">
          <h2
            id="import-file-heading"
            className="font-semibold"
            style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)' }}
          >
            {tx.importStepFile ?? '3. Pick file'}
          </h2>
          <FileDropzone
            file={file}
            onFile={(next) => {
              setFile(next)
              setValidationCode(null)
            }}
            disabled={upload.isUploading || !format}
            errorMessage={errorMessage}
          />
        </section>

        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={upload.isUploading}
            className="w-full md:w-auto min-h-[44px]"
          >
            {upload.isUploading
              ? (tx.importUploading ?? 'Uploading...')
              : (tx.importSubmit ?? 'Upload and preview')}
          </Button>
        </div>
      </PageContainer>
    </AppShell>
  )
}
