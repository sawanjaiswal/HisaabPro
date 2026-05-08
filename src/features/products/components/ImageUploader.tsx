/** Product image uploader — thumbnail grid + add button. Max 5 images. */

import { useState, useCallback } from 'react'
import { Camera, Image as ImageIcon, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import {
  pickFromCamera,
  pickFromGallery,
  resizeImage,
  validateImageSize,
  MAX_BYTES,
} from '../image-upload.utils'
import './image-uploader.css'

interface ImageUploaderProps {
  /** Current ordered list of image data URLs */
  value: string[]
  onChange: (next: string[]) => void
  max?: number
}

export function ImageUploader({ value, onChange, max = 5 }: ImageUploaderProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const processImages = useCallback(
    async (raw: string[]) => {
      if (!raw.length) return
      const remaining = max - value.length
      const toAdd = raw.slice(0, remaining)

      setLoading(true)
      const processed: string[] = []
      for (const dataUrl of toAdd) {
        const sizeError = validateImageSize(dataUrl, MAX_BYTES)
        if (sizeError) {
          toast.error(sizeError)
          continue
        }
        try {
          const resized = await resizeImage(dataUrl)
          processed.push(resized)
        } catch {
          toast.error(t.imageProcessingFailed)
        }
      }
      setLoading(false)

      if (processed.length) {
        onChange([...value, ...processed])
      }
      if (raw.length > remaining) {
        toast.warning(t.imageMaxReached.replace('{max}', String(max)))
      }
    },
    [value, onChange, max, toast, t],
  )

  const handleCamera = useCallback(async () => {
    const imgs = await pickFromCamera()
    await processImages(imgs)
  }, [processImages])

  const handleGallery = useCallback(async () => {
    const imgs = await pickFromGallery()
    await processImages(imgs)
  }, [processImages])

  const handleDelete = useCallback(
    (idx: number) => {
      onChange(value.filter((_, i) => i !== idx))
    },
    [value, onChange],
  )

  const handleMoveUp = useCallback(
    (idx: number) => {
      if (idx === 0) return
      const next = [...value]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      onChange(next)
    },
    [value, onChange],
  )

  const handleMoveDown = useCallback(
    (idx: number) => {
      if (idx === value.length - 1) return
      const next = [...value]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      onChange(next)
    },
    [value, onChange],
  )

  const canAdd = value.length < max

  return (
    <div className="image-uploader" aria-label={t.productImages}>
      {value.length > 0 && (
        <div className="image-uploader__grid" role="list" aria-label={t.productImagesList}>
          {value.map((src, idx) => (
            <div
              key={src.slice(-20) + idx}
              className="image-uploader__thumb"
              role="listitem"
            >
              <img
                src={src}
                alt={`${t.productImage} ${idx + 1}`}
                className="image-uploader__img"
                draggable={false}
              />
              {idx === 0 && (
                <span className="image-uploader__primary-badge" aria-label={t.primaryImage}>
                  {t.primary}
                </span>
              )}
              <div className="image-uploader__thumb-actions" aria-label={t.imageActions}>
                <button
                  type="button"
                  className="image-uploader__icon-btn"
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                  aria-label={t.moveImageUp}
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="image-uploader__icon-btn"
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx === value.length - 1}
                  aria-label={t.moveImageDown}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="image-uploader__icon-btn image-uploader__icon-btn--danger"
                  onClick={() => handleDelete(idx)}
                  aria-label={`${t.deleteImage} ${idx + 1}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="image-uploader__actions">
          <button
            type="button"
            className="image-uploader__add-btn"
            onClick={handleGallery}
            disabled={loading}
            aria-label={t.addFromGallery}
          >
            <ImageIcon size={18} aria-hidden="true" />
            <span>{t.gallery}</span>
          </button>
          <button
            type="button"
            className="image-uploader__add-btn"
            onClick={handleCamera}
            disabled={loading}
            aria-label={t.addFromCamera}
          >
            <Camera size={18} aria-hidden="true" />
            <span>{t.camera}</span>
          </button>
        </div>
      )}

      {loading && (
        <p className="image-uploader__loading" role="status" aria-live="polite">
          {t.processingImage}
        </p>
      )}

      <p className="image-uploader__hint">
        {t.imageUploaderHint.replace('{max}', String(max)).replace('{count}', String(value.length))}
      </p>
    </div>
  )
}
