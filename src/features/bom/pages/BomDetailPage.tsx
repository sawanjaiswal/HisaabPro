/** BomDetailPage — /bom/:id — read-only detail with Edit / Run / Delete */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Play, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { useBomDetail, bomKeys } from '../hooks/useBom'
import { BomComponentsTable } from '../components/BomComponentsTable'
import { formatVersionBadge } from '../bom.utils'
import { deleteBom } from '../bom.service'
import { useQueryClient } from '@tanstack/react-query'
import '../bom.css'

function BomDetailSkeleton() {
  return (
    <div className="bom-skeleton" aria-busy="true" aria-label="Loading recipe">
      <div className="bom-skeleton__card" style={{ height: 48 }} />
      <div className="bom-skeleton__card" style={{ height: 32 }} />
      {[0, 1, 2].map((i) => <div key={i} className="bom-skeleton__card" style={{ height: 44 }} />)}
    </div>
  )
}

export default function BomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { bom, status, refresh } = useBomDetail(id ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!id) return null

  const handleDelete = async () => {
    if (!bom) return
    setDeleting(true)
    try {
      await deleteBom(id, bom.name)
      await queryClient.invalidateQueries({ queryKey: bomKeys.all() })
      toast.success('Recipe deleted')
      navigate('/bom')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete recipe'
      toast.error(msg)
      setDeleting(false)
    }
  }

  return (
    <div className="bom-page">
      {/* Back */}
      <div className="bom-page__header">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate('/bom')} aria-label="Back to recipes">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="bom-page__title">Recipe Detail</h1>
      </div>

      {/* Loading */}
      {status === 'loading' && <BomDetailSkeleton />}

      {/* Error */}
      {status === 'error' && (
        <ErrorState title="Could not load recipe" onRetry={refresh} />
      )}

      {/* Success */}
      {status === 'success' && bom && (
        <>
          {/* Summary card */}
          <div className="bom-detail-card">
            <div className="bom-detail-card__header">
              <div>
                <div className="bom-detail-card__product">{bom.productName}</div>
                <div className="bom-detail-card__name">{bom.name}</div>
              </div>
              <div className="bom-detail-card__badges">
                <span className="badge badge--neutral">{formatVersionBadge(bom.version)}</span>
                {bom.isDefault && <span className="badge badge--primary">Default</span>}
                {!bom.isActive && <span className="badge badge--warning">Inactive</span>}
              </div>
            </div>
            {bom.notes && <p className="bom-detail-card__notes">{bom.notes}</p>}
            <div className="bom-detail-card__meta">
              <span>{bom.components.length} component{bom.components.length !== 1 ? 's' : ''}</span>
              <span>{bom.productionRunCount} run{bom.productionRunCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Components */}
          <section className="bom-section">
            <h2 className="bom-section__title">Components</h2>
            <BomComponentsTable components={bom.components} />
          </section>

          {/* Actions */}
          <div className="bom-detail-actions">
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate(`/production-runs/new?bomId=${id}`)}
              aria-label="Start production run"
            >
              <Play size={16} aria-hidden="true" /> Start Run
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/bom/${id}/edit`)}
              aria-label="Edit recipe"
            >
              <Edit2 size={16} aria-hidden="true" /> Edit
            </Button>
            <button
              type="button"
              className="btn btn-ghost btn-danger-ghost"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete recipe"
            >
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); void handleDelete() }}
        title="Delete Recipe?"
        description="This will soft-delete the recipe. Existing production runs will not be affected."
        confirmLabel={deleting ? 'Deleting...' : 'Delete Recipe'}
        cancelLabel="Keep Recipe"
        isDanger
        isLoading={deleting}
      />
    </div>
  )
}
