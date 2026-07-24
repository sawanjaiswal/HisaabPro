/** BomDetailPage — /bom/:id — read-only detail with Edit / Run / Delete */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Play, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/context/LanguageContext'
import { ApiError } from '@/lib/api'
import { useBomDetail, bomKeys } from '../hooks/useBom'
import { BomComponentsTable } from '../components/BomComponentsTable'
import { formatVersionBadge } from '../bom.utils'
import { deleteBom } from '../bom.service'
import { useQueryClient } from '@tanstack/react-query'
import '../bom.css'

function BomDetailSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="bom-skeleton" aria-busy="true" aria-label={t.bomLoadingRecipes}>
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
  const { t } = useLanguage()
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
      toast.success(t.bomRecipeDeleted)
      navigate('/bom')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t.bomDeleteFailed
      toast.error(msg)
      setDeleting(false)
    }
  }

  return (
    <div className="bom-page">
      {/* Back */}
      <div className="bom-page__header">
        <Button variant="ghost" type="button" className="btn-icon" onClick={() => navigate('/bom')} aria-label={t.bomBackToRecipes}>
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <h1 className="bom-page__title">{t.bomRecipeDetail}</h1>
      </div>

      {/* Loading */}
      {status === 'loading' && <BomDetailSkeleton />}

      {/* Error */}
      {status === 'error' && (
        <ErrorState title={t.bomLoadRecipeError} onRetry={refresh} />
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
                {bom.isDefault && <span className="badge badge--primary">{t.defaultLabel}</span>}
                {!bom.isActive && <span className="badge badge--warning">{t.inactive}</span>}
              </div>
            </div>
            {bom.notes && <p className="bom-detail-card__notes">{bom.notes}</p>}
            <div className="bom-detail-card__meta">
              <span>{bom.components.length} {bom.components.length !== 1 ? t.bomComponentsLower : t.bomComponent}</span>
              <span>{bom.productionRunCount} {bom.productionRunCount !== 1 ? t.bomRuns : t.bomRun}</span>
            </div>
          </div>

          {/* Components */}
          <section className="bom-section">
            <h2 className="bom-section__title">{t.bomComponentsHeading}</h2>
            <BomComponentsTable components={bom.components} />
          </section>

          {/* Actions */}
          <div className="bom-detail-actions">
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate(`/production-runs/new?bomId=${id}`)}
              aria-label={t.bomStartProductionRun}
            >
              <Play size={16} aria-hidden="true" /> {t.bomStartRun}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/bom/${id}/edit`)}
              aria-label={t.bomEditRecipeAria}
            >
              <Edit2 size={16} aria-hidden="true" /> {t.edit}
            </Button>
            <Button variant="none"
              type="button"
              className="btn btn-ghost btn-danger-ghost"
              onClick={() => setConfirmDelete(true)}
              aria-label={t.bomDeleteRecipeAria}
            >
              <Trash2 size={16} aria-hidden="true" /> {t.delete}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); void handleDelete() }}
        title={t.bomDeleteRecipeTitle}
        description={t.bomDeleteRecipeDesc}
        confirmLabel={deleting ? t.deleting : t.bomDeleteConfirm}
        cancelLabel={t.bomKeepRecipe}
        isDanger
        isLoading={deleting}
      />
    </div>
  )
}
