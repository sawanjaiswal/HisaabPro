/** Bulk Import Parties — Page (lazy loaded) */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useBulkImport } from './useBulkImport'
import { ContactPicker } from './components/ContactPicker'
import { ImportPreview } from './components/ImportPreview'
import { ImportProgress } from './components/ImportProgress'
import './bulk-import.css'

export default function BulkImportPage() {
  const navigate = useNavigate()
  const {
    status, contacts, partyType, setPartyType,
    importResult, progress, error,
    selectedCount, totalValid,
    pickContacts, importCsv, toggleContact, selectAll,
    executeImport, reset,
  } = useBulkImport()

  return (
    <AppShell>
      <Header
        title="Import Parties"
        backTo={status === 'idle' || status === 'done' ? ROUTES.PARTIES : undefined}
        actions={
          status === 'preview' ? (
            <button className="btn btn-ghost btn-sm" onClick={reset} aria-label="Start over">
              Reset
            </button>
          ) : undefined
        }
      />

      <PageContainer>
        {(status === 'idle' || status === 'picking') && (
          <ContactPicker onPickContacts={pickContacts} onImportCsv={importCsv} />
        )}

        {status === 'preview' && (
          <ImportPreview
            contacts={contacts}
            partyType={partyType}
            selectedCount={selectedCount}
            totalValid={totalValid}
            onToggle={toggleContact}
            onSelectAll={selectAll}
            onTypeChange={setPartyType}
            onConfirm={executeImport}
            onBack={reset}
          />
        )}

        {(status === 'importing' || status === 'done') && (
          <ImportProgress
            progress={progress}
            total={selectedCount}
            result={importResult}
            onDone={reset}
            onGoToParties={() => navigate(ROUTES.PARTIES)}
          />
        )}

        {status === 'error' && (
          <div className="bulk-import-error">
            <p>{error ?? 'Something went wrong. Please try again.'}</p>
            <button type="button" className="btn btn-primary btn-md" onClick={reset}>
              Try Again
            </button>
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
