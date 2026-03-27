/** Batches — List page for a product's batches */

import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Layers } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useBatches } from './useBatches'
import { BatchCard } from './components/BatchCard'
import './batches.css'
import { useLanguage } from '@/hooks/useLanguage'

function BatchListSkeleton() {
  return (
    <div className="batch-skeleton-list" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`batch-skel-${i}`} className="batch-skeleton-card">
          <Skeleton width="40px" height="40px" borderRadius="var(--radius-md)" />
          <div className="batch-skeleton-lines">
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="40%" height="0.75rem" />
            <Skeleton width="80%" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BatchesPage() {
  const { t } = useLanguage()
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { batches, status, refetch, deleteBatch, isDeleting } = useBatches(productId)

  const backPath = productId
    ? ROUTES.PRODUCT_DETAIL.replace(':id', productId)
    : ROUTES.PRODUCTS

  const goToCreate = () => {
    if (productId) {
      navigate(ROUTES.BATCH_NEW.replace(':productId', productId))
    }
  }

  return (
    <AppShell>
      <Header
        title={t.batches}
        backTo={backPath}
        actions={
          status === 'success' && batches && batches.batches.length > 0 ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={goToCreate}
              aria-label={t.addNewBatch}
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          ) : undefined
        }
      />

      <PageContainer>
        {status === 'loading' && <BatchListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadBatches}
            message={t.checkConnectionRetry2}
            onRetry={refetch}
          />
        )}

        {status === 'success' && batches && batches.batches.length === 0 && (
          <EmptyState
            icon={<Layers size={40} aria-hidden="true" />}
            title={t.noBatchesYet}
            description={t.addFirstBatchEmptyDesc}
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={goToCreate}
                aria-label={t.addFirstBatchBtnAria}
              >
                {t.addFirstBatchBtn}
              </button>
            }
          />
        )}

        {status === 'success' && batches && batches.batches.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {batches.total} {batches.total === 1 ? t.batchesFound : t.batchesFoundPlural} found
            </div>
            <div className="batch-list stagger-list" role="list" aria-label={t.batchesListAria}>
              {batches.batches.map((batch) => (
                <div key={batch.id} className="batch-list-item" role="listitem">
                  <BatchCard
                    batch={batch}
                    onDelete={deleteBatch}
                    isDeleting={isDeleting}
                  />
                  <div className="divider" aria-hidden="true" />
                </div>
              ))}
            </div>
          </>
        )}
      </PageContainer>

      {status === 'success' && batches && batches.batches.length > 0 && (
        <button className="fab" onClick={goToCreate} aria-label={t.addNewBatch}>
          <Plus size={24} aria-hidden="true" />
        </button>
      )}
    </AppShell>
  )
}
