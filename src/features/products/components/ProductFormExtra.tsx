/** Create Product — Tax category, HSN/SAC, barcode, images, description, status section */

import { Input } from '@/components/ui/Input'
import { Select, SelectItem } from '@/components/ui/Select'

const NONE = '__none__' as const
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductFormData, ProductStatus } from '../product.types'
import { PRODUCT_STATUS_LABELS, HSN_CODE_MAX, SAC_CODE_MAX, PRODUCT_DESCRIPTION_MAX } from '../product.constants'
import type { TaxCategory } from '@/lib/types/tax.types'
import { BarcodeField } from './BarcodeField'
import { ImageUploader } from './ImageUploader'
import '../barcode.css'
import './image-uploader.css'
import { Textarea } from '@/components/ui/Textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'

interface ProductFormExtraProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
  taxCategories?: TaxCategory[]
}

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'ACTIVE',   label: PRODUCT_STATUS_LABELS.ACTIVE },
  { value: 'INACTIVE', label: PRODUCT_STATUS_LABELS.INACTIVE },
]

export function ProductFormExtra({ form, errors, onUpdate, taxCategories = [] }: ProductFormExtraProps) {
  const { t } = useLanguage()
  return (
    <div className="create-party-section py-0">
      {taxCategories.length > 0 && (
        <div className="input-group">
          <Select
            label={t.taxCategoryLabel}
            id="product-tax-cat"
            value={form.taxCategoryId ?? NONE}
            onValueChange={(v) => onUpdate('taxCategoryId', v === NONE ? null : v)}
            ariaLabel={t.selectTaxCategory}
          >
            <SelectItem value={NONE}>{t.noneExempt}</SelectItem>
            {taxCategories.map((tc) => (
              <SelectItem key={tc.id} value={tc.id}>{tc.name}</SelectItem>
            ))}
          </Select>
        </div>
      )}

      <div className="input-group">
        <span className="input-label">{t.productImagesLabel}</span>
        <ImageUploader
          value={form.pendingImages ?? []}
          onChange={(imgs) => onUpdate('pendingImages', imgs)}
          max={5}
        />
      </div>

      <BarcodeField form={form} errors={errors} onUpdate={onUpdate} />

      <Input label={t.hsnCodeGoods} id="product-hsn" value={form.hsnCode ?? ''} onChange={(e) => onUpdate('hsnCode', e.target.value || undefined)} error={errors.hsnCode} placeholder="e.g. 19023090" maxLength={HSN_CODE_MAX} autoComplete="off" />

      <Input label={t.sacCodeServices} id="product-sac" value={form.sacCode ?? ''} onChange={(e) => onUpdate('sacCode', e.target.value || undefined)} error={errors.sacCode} placeholder="e.g. 998314" maxLength={SAC_CODE_MAX} autoComplete="off" />

      <div className="input-group">
        <Textarea
          label={t.descriptionLabel}
          id="product-description"
          value={form.description ?? ''}
          onChange={(e) => onUpdate('description', e.target.value || undefined)}
          placeholder={t.additionalProductDetails}
          rows={3}
          maxLength={PRODUCT_DESCRIPTION_MAX}
        />
      </div>

      <div className="input-group">
        <span className="input-label" id="product-status-label">{t.statusLabel}</span>
        <Tabs
          value={form.status}
          onValueChange={(val) => onUpdate('status', val as ProductStatus)}
          className="w-full"
        >
          <TabsList variant="segmented" fullWidth aria-labelledby="product-status-label">
            {STATUS_OPTIONS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                aria-label={`${t.setProductStatusTo} ${option.label}`}
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
