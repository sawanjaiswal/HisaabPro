/** BomFormPage — /bom/new + /bom/:id/edit */

import { Text } from '@/components/ui/Text'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Loader2 } from 'lucide-react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BomFormHeader } from '../components/BomFormHeader'
import { BomComponentRow } from '../components/BomComponentRow'
import { useBomDetail } from '../hooks/useBom'
import { useBomForm, hydrateFormFromDetail } from '../hooks/useBomForm'
import { useLanguage } from '@/context/LanguageContext'
import { BOM_MAX_COMPONENTS } from '../bom.constants'
import '../bom.css'
import { Heading } from '@/components/ui/Heading'

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FormSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="bom-skeleton" aria-busy="true" aria-label={t.bomLoadingRecipes}>
      <div className="bom-skeleton__card" style={{ height: 56 }} />
      <div className="bom-skeleton__card" style={{ height: 56 }} />
      <div className="bom-skeleton__card" style={{ height: 100 }} />
    </div>
  )
}

// ─── Create wrapper ───────────────────────────────────────────────────────────

function BomCreateForm() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { form, errors, saving, updateField, addRow, updateRow, removeRow, save } = useBomForm()

  return (
    <AppShell header={<Header title={t.bomNewRecipe} backTo="/bom" />}>
      <PageContainer className="bom-page py-4 pb-24 max-w-2xl mx-auto">
        <form onSubmit={(e) => { e.preventDefault(); void save() }} noValidate>
        <BomFormHeader form={form} errors={errors} editMode={false} onUpdate={updateField} />

        <section className="bom-section">
          <div className="bom-section__header">
            <Heading level={2} className="bom-section__title">{t.bomComponentsHeading}</Heading>
            <span className="bom-section__count">{form.components.length}/{BOM_MAX_COMPONENTS}</span>
          </div>

          {errors.components && (
            <Text className="input-error" role="alert">{errors.components}</Text>
          )}

          <div className="bom-rows">
            {form.components.map((row, i) => (
              <BomComponentRow
                key={row.id}
                row={row}
                index={i}
                finishedProductId={form.productId}
                errors={errors.rows?.[i]}
                onChange={updateRow}
                onRemove={removeRow}
              />
            ))}
          </div>

          {form.components.length < BOM_MAX_COMPONENTS && (
            <Button
              type="button"
              variant="ghost" size="sm" className="bom-add-row"
              onClick={addRow}
              aria-label={t.bomAddComponentRow}
            >
              <Plus size={14} aria-hidden="true" /> {t.bomAddComponent}
            </Button>
          )}
        </section>

        <div className="bom-form-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/bom')}
            disabled={saving}
          >
            {t.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? <><Loader2 size={16} className="btn-spinner" aria-hidden="true" /> {t.saving}</> : t.bomSaveRecipe}
          </Button>
        </div>
      </form>
      </PageContainer>
    </AppShell>
  )
}

// ─── Edit wrapper ─────────────────────────────────────────────────────────────

function BomEditForm({ id }: { id: string }) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { bom, status, refresh } = useBomDetail(id)
  const [formInit, setFormInit] = useState(false)
  const { form, errors, saving, updateField, addRow, updateRow, removeRow, save } =
    useBomForm(id, bom ? hydrateFormFromDetail(bom) : undefined)

  useEffect(() => {
    if (bom && !formInit) setFormInit(true)
  }, [bom, formInit])

  if (status === 'loading') return (
    <AppShell header={<Header title={t.bomEditRecipeTitle} backTo={`/bom/${id}`} />}>
      <PageContainer className="bom-page py-4 max-w-2xl mx-auto"><FormSkeleton /></PageContainer>
    </AppShell>
  )

  if (status === 'error') return (
    <AppShell header={<Header title={t.bomEditRecipeTitle} backTo={`/bom/${id}`} />}>
      <PageContainer className="bom-page py-4 max-w-2xl mx-auto">
        <ErrorState title={t.bomLoadRecipeError} onRetry={refresh} />
      </PageContainer>
    </AppShell>
  )

  return (
    <AppShell header={<Header title={t.bomEditRecipeTitle} backTo={`/bom/${id}`} />}>
      <PageContainer className="bom-page py-4 pb-24 max-w-2xl mx-auto">
        <form onSubmit={(e) => { e.preventDefault(); void save() }} noValidate>
        <BomFormHeader form={form} errors={errors} editMode={true} onUpdate={updateField} />

        <section className="bom-section">
          <div className="bom-section__header">
            <Heading level={2} className="bom-section__title">{t.bomComponentsHeading}</Heading>
            <span className="bom-section__count">{form.components.length}/{BOM_MAX_COMPONENTS}</span>
          </div>

          {errors.components && <Text className="input-error" role="alert">{errors.components}</Text>}

          <div className="bom-rows">
            {form.components.map((row, i) => (
              <BomComponentRow
                key={row.id}
                row={row}
                index={i}
                finishedProductId={form.productId}
                errors={errors.rows?.[i]}
                onChange={updateRow}
                onRemove={removeRow}
              />
            ))}
          </div>

          {form.components.length < BOM_MAX_COMPONENTS && (
            <Button type="button" variant="ghost" size="sm" className="bom-add-row" onClick={addRow} aria-label={t.bomAddComponent}>
              <Plus size={14} aria-hidden="true" /> {t.bomAddComponent}
            </Button>
          )}
        </section>

        <div className="bom-form-actions">
          <Button type="button" variant="ghost" onClick={() => navigate(`/bom/${id}`)} disabled={saving}>{t.cancel}</Button>
          <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
            {saving ? <><Loader2 size={16} className="btn-spinner" aria-hidden="true" /> {t.saving}</> : t.bomSaveRecipe}
          </Button>
        </div>
      </form>
      </PageContainer>
    </AppShell>
  )
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export default function BomFormPage() {
  const { id } = useParams<{ id: string }>()
  if (id) return <BomEditForm id={id} />
  return <BomCreateForm />
}
