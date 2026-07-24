/**
 * Cash Register — Top-level page.
 * Two tabs: Calculator | History.
 * Dialog orchestration (edit, void, delete, large-amount warning).
 * data-hide-bottom-nav: handled by PersistentNav via route pattern — not needed as attr.
 */

import { useState, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageContainer } from '@/components/layout/PageContainer'
import { Header } from '@/components/layout/Header'
import { useAuth } from '@/context/AuthContext'
import { useCashCalculator } from '../useCashCalculator'
import { useCashEntry } from '../useCashRegisterQueries'
import { useRestoreCashEntry } from '../useCashRegisterMutations'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { LARGE_AMOUNT_PAISE } from '../cashRegister.constants'
import { CalculatorPanel } from './CalculatorPanel'
import { HistoryPanel } from './HistoryPanel'
import { EditEntryDrawer } from './EditEntryDrawer'
import { VoidConfirmDialog } from './VoidConfirmDialog'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { LargeAmountWarningDialog } from './LargeAmountWarningDialog'
import { ROUTES } from '@/config/routes.config'
import type { CashRegisterTab } from '../cashRegister.types'
import '../cash-register.css'
import { Button } from '@/components/ui/Button'

export default function CashRegisterPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useLanguage()
  const businessId = user?.businessId ?? ''

  const [tab, setTab] = useState<CashRegisterTab>('calculator')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDirection, setPendingDirection] = useState<'IN' | 'OUT' | null>(null)

  const calc = useCashCalculator()
  const { data: editEntry } = useCashEntry(businessId, editingId)
  const restoreMutation = useRestoreCashEntry(businessId)

  const isOffline = !navigator.onLine

  const handleCommit = useCallback((direction: 'IN' | 'OUT') => {
    if (calc.liveTotalPaise !== null && calc.liveTotalPaise > LARGE_AMOUNT_PAISE) {
      setPendingDirection(direction)
      return
    }
    void calc.commit(direction)
  }, [calc])

  const handleConfirmLarge = useCallback(() => {
    if (pendingDirection) void calc.commit(pendingDirection)
    setPendingDirection(null)
  }, [pendingDirection, calc])

  const handleRestore = useCallback(async (id: string) => {
    const key = await buildKey(`restore|${id}`)
    try {
      await restoreMutation.mutateAsync({ businessId, id, idempotencyKey: key })
      toast.success(t.cashRegToastEntryRestored)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.cashRegToastErrorRestore)
    }
  }, [businessId, restoreMutation, toast, t])

  return (
    <AppShell>
      <Header title={t.cashRegTitle} backTo={ROUTES.DASHBOARD} />

      {/* Tab toggle */}
      <div className="cr-tabs" role="tablist" aria-label={t.cashRegTabsAria}>
        <Button variant="none"
          type="button"
          role="tab"
          className={`cr-tabs__tab${tab === 'calculator' ? ' cr-tabs__tab--active' : ''}`}
          aria-selected={tab === 'calculator'}
          onClick={() => setTab('calculator')}
        >
          {t.cashRegTabCalculator}
        </Button>
        <Button variant="none"
          type="button"
          role="tab"
          className={`cr-tabs__tab${tab === 'history' ? ' cr-tabs__tab--active' : ''}`}
          aria-selected={tab === 'history'}
          onClick={() => setTab('history')}
        >
          {t.cashRegTabHistory}
        </Button>
      </div>

      {/* Tab panels */}
      {tab === 'calculator' ? (
        <div role="tabpanel" aria-label={t.cashRegTabCalculator}>
          <PageContainer variant="form" asDiv>
          <CalculatorPanel
            expression={calc.expression}
            liveTotalPaise={calc.liveTotalPaise}
            evalError={calc.evalError}
            isLargeAmount={calc.isLargeAmount}
            note={calc.note}
            onChangeNote={calc.setNote}
            onKey={calc.dispatch}
            onCommit={handleCommit}
            isSubmitting={calc.isSubmitting}
            isOffline={isOffline}
          />
          </PageContainer>
        </div>
      ) : (
        <div role="tabpanel" aria-label={t.cashRegTabHistory}>
          <PageContainer variant="list" asDiv>
          <HistoryPanel
            onEdit={setEditingId}
            onVoid={setVoidingId}
            onRestore={(id) => void handleRestore(id)}
            onDelete={setDeletingId}
          />
          </PageContainer>
        </div>
      )}

      {/* Dialogs / drawers */}
      {editEntry && editingId && (
        <EditEntryDrawer
          entry={editEntry}
          businessId={businessId}
          onClose={() => setEditingId(null)}
        />
      )}

      {voidingId && (
        <VoidConfirmDialog
          entryId={voidingId}
          businessId={businessId}
          onClose={() => setVoidingId(null)}
        />
      )}

      {deletingId && (
        <DeleteConfirmDialog
          entryId={deletingId}
          businessId={businessId}
          onClose={() => setDeletingId(null)}
        />
      )}

      {pendingDirection && calc.liveTotalPaise !== null && (
        <LargeAmountWarningDialog
          paise={calc.liveTotalPaise}
          onConfirm={handleConfirmLarge}
          onCancel={() => setPendingDirection(null)}
        />
      )}
    </AppShell>
  )
}

async function buildKey(material: string): Promise<string> {
  const full = `${material}|${crypto.randomUUID()}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(full))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
