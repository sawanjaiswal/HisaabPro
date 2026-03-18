/** Competitor Data Import — Page (lazy loaded) */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useDataImport } from './useDataImport'
import { SourceSelector } from './components/SourceSelector'
import { MappingPreview } from './components/MappingPreview'
import { ImportProgress } from '@/features/bulk-import/components/ImportProgress'
import type { BulkImportResult } from '@/features/bulk-import/bulk-import.types'
import './data-import.css'

export default function DataImportPage() {
  const navigate = useNavigate()
  const {
    status, dataType, headers, mappings, rows, importResult, progress, error, validCount,
    setDataType, parseFile, updateMapping, applyUpdatedMappings, executeImport, reset,
  } = useDataImport()

  // Adapt importResult to BulkImportResult shape for shared ImportProgress component
  const bulkResult: BulkImportResult | null = importResult ? {
    total: importResult.total,
    succeeded: importResult.succeeded,
    failed: importResult.failed,
    errors: importResult.errors.map((e) => ({ name: `Row ${e.row}`, reason: e.reason })),
  } : null

  return (
    <AppShell>
      <Header
        title="Import Data"
        backTo={status === 'idle' ? ROUTES.SETTINGS : undefined}
        actions={
          status !== 'idle' && status !== 'importing' ? (
            <button className="btn btn-ghost btn-sm" onClick={reset} aria-label="Start over">
              Reset
            </button>
          ) : undefined
        }
      />

      <PageContainer>
        {status === 'idle' && (
          <SourceSelector
            dataType={dataType}
            onDataTypeChange={setDataType}
            onSelectFile={parseFile}
          />
        )}

        {(status === 'mapping' || status === 'preview') && (
          <MappingPreview
            headers={headers}
            mappings={mappings}
            rows={rows}
            dataType={dataType}
            validCount={validCount}
            onUpdateMapping={updateMapping}
            onApply={applyUpdatedMappings}
            onConfirm={executeImport}
            onBack={reset}
          />
        )}

        {(status === 'importing' || status === 'done') && (
          <ImportProgress
            progress={progress}
            total={validCount}
            result={bulkResult}
            onDone={reset}
            onGoToParties={() => navigate(ROUTES.PARTIES)}
          />
        )}

        {status === 'error' && (
          <div className="data-import-error">
            <p>{error ?? 'Something went wrong.'}</p>
            <button type="button" className="btn btn-primary btn-md" onClick={reset}>
              Try Again
            </button>
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
