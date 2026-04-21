/** Batch Detail — View and manage a single batch */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useApi } from '@/hooks/useApi'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/lib/api'
import { BatchDetailInfo } from './components/BatchDetailInfo'
import { DeleteBatchDialog } from './components/DeleteBatchDialog'
import { BatchForm } from './components/BatchForm'
import type { Batch } from './batch.types'
import './batches.css'
import { useLanguage } from '@/hooks/useLanguage'

function DetailSkeleton() {
  return (
    <div className="batch-detail-skeleton" aria-hidden="true">
      <Skeleton width="60%" height="1.5rem" />
      <Skeleton width="100%" height="4rem" />
      <Skeleton width="100%" height="4rem" />
      <Skeleton width="100%" height="4rem" />
    </div>
  )
}

export default function BatchDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: batch, status, error, refetch } = useApi<Batch>(
    id ? `/batches/${id}` : null
  )

  const handleDelete = async () => {
    if (!batch) return
    setIsDeleting(true)
    try {
      await api(`/batches/${batch.id}`, { method: 'DELETE' })
      toast.success(`Batch ${batch.batchNumber} deleted`)
      navigate(-1)
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete batch'
      toast.error(message)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleEditSuccess = () => {
    toast.success('Batch updated')
    setIsEditing(false)
    refetch()
  }

  if (isEditing && batch) {
    return (
      <AppShell>
        <Header title={t.editBatch} backTo={true} />
        <PageContainer className="stagger-enter space-y-6">
          <BatchForm
            productId={batch.productId}
            existingBatch={batch}
            onSuccess={handleEditSuccess}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header
        title={batch?.batchNumber ?? 'Batch'}
        backTo={true}
        actions={
          batch ? (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setIsEditing(true)}
                aria-label={t.editBatchAria}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              {batch.currentStock === 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label={t.deleteBatch}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </>
          ) : undefined
        }
      />

      <PageContainer className="stagger-enter space-y-6">
        {status === 'loading' && <DetailSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadBatch}
            message={error?.message ?? 'Check your connection and try again.'}
            onRetry={refetch}
          />
        )}

        {status === 'success' && batch && <BatchDetailInfo batch={batch} />}

        {showDeleteConfirm && batch && (
          <DeleteBatchDialog
            batchNumber={batch.batchNumber}
            isDeleting={isDeleting}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
