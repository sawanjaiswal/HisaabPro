/** GodownDetail — View godown info + stock */

import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Trash2, MapPin } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useApi } from '@/hooks/useApi'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { GODOWN_PAGE_SIZE } from './godown.constants'
import { GodownStockList } from './components/GodownStockList'
import type { Godown, GodownStockResponse } from './godown.types'
import './godowns.css'

export default function GodownDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteGuard = useRef(false)

  const { data: godown, status, error, refetch } = useApi<Godown>(
    id ? `/godowns/${id}` : null
  )
  const { data: stockData, status: stockStatus, refetch: refetchStock } = useApi<GodownStockResponse>(
    id ? `/godowns/${id}/stock?limit=${GODOWN_PAGE_SIZE}` : null
  )

  const handleDelete = async () => {
    if (!godown || !id || deleteGuard.current) return
    deleteGuard.current = true
    setIsDeleting(true)
    try {
      await api(`/godowns/${id}`, { method: 'DELETE' })
      toast.success(`${godown.name} ${t.deleted}`)
      navigate(ROUTES.GODOWNS)
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : t.failedToDeleteGodown
      toast.error(message)
    } finally {
      deleteGuard.current = false
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <AppShell>
      <Header
        title={godown?.name ?? t.godownLabel}
        backTo={ROUTES.GODOWNS}
        actions={
          godown ? (
            <div className="godown-detail-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(ROUTES.GODOWN_EDIT.replace(':id', id ?? ''))}
                aria-label={`Edit ${godown.name}`}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button
                className="btn btn-ghost btn-sm godown-btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                aria-label={`Delete ${godown.name}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ) : undefined
        }
      />

      <PageContainer className="space-y-6">
        {status === 'loading' && (
          <div className="godown-detail-skeleton">
            <Skeleton height="1.5rem" width="60%" />
            <Skeleton height="1rem" width="80%" />
            <Skeleton height="4rem" count={3} />
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadGodown}
            message={error?.message ?? t.checkConnectionRetry}
            onRetry={refetch}
          />
        )}

        {status === 'success' && godown && (
          <div className="stagger-enter">
            <div className="godown-detail-info">
              {godown.isDefault && (
                <span className="godown-card__badge">{t.defaultGodown}</span>
              )}
              {godown.address && (
                <div className="godown-detail-address">
                  <MapPin size={14} aria-hidden="true" />
                  <span>{godown.address}</span>
                </div>
              )}
            </div>

            <GodownStockList stockData={stockData} status={stockStatus} onRetry={refetchStock} />
          </div>
        )}
        <ConfirmDialog
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title={t.deleteGodownTitle}
          description={t.deleteGodownDesc}
          confirmLabel={t.delete}
          isLoading={isDeleting}
        />
      </PageContainer>
    </AppShell>
  )
}
