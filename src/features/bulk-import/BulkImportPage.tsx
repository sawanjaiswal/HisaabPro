/** Bulk Import Parties — Page (lazy loaded) */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useBulkImport } from './useBulkImport'
import { ContactPicker } from './components/ContactPicker'
import { ImportPreview } from './components/ImportPreview'
import { ImportProgress } from './components/ImportProgress'
import './bulk-import.css'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

export default function BulkImportPage() {
  const { t } = useLanguage()
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
        title={t.importParties}
        backTo={status === 'idle' || status === 'done' ? ROUTES.PARTIES : undefined}
        actions={
          status === 'preview' ? (
            <Button variant="ghost" size="sm" onClick={reset} aria-label={t.startOver}>
              {t.reset}
            </Button>
          ) : undefined
        }
      />

      <HeroPage>
        {status === 'idle' && (
          <ContactPicker onPickContacts={pickContacts} onImportCsv={importCsv} />
        )}

        {status === 'picking' && (
          <div className="space-y-3" aria-busy="true" aria-label={t.bulkImportPreparing}>
            <Skeleton height="56px" borderRadius="var(--radius-xl)" />
            <Skeleton height="56px" borderRadius="var(--radius-xl)" count={4} />
          </div>
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
          <ErrorState
            title={t.somethingWentWrong}
            message={error ?? undefined}
            onRetry={reset}
            retryLabel={t.tryAgain}
          />
        )}
      </HeroPage>
    </AppShell>
  )
}
