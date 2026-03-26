/** Bill Scanning — Image preprocessing utilities
 *
 * Resize, grayscale conversion, and thumbnail generation for OCR input.
 * No hooks, no side effects beyond canvas operations.
 */

import { MAX_IMAGE_DIMENSION } from './bill-scan.constants'

/**
 * Resize image to max dimension and convert to grayscale for better OCR.
 * Returns a data URL of the processed image.
 */
export async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height))
      width = Math.round(width * scale)
      height = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }

      // Draw and convert to grayscale for better OCR accuracy
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        // Boost contrast
        const enhanced = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30)
        data[i] = enhanced
        data[i + 1] = enhanced
        data[i + 2] = enhanced
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Create a small thumbnail for preview (max 400px).
 */
export async function createThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      const scale = Math.min(1, 400 / Math.max(width, height))
      width = Math.round(width * scale)
      height = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}
