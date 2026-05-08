/** Product image upload service — POST /api/products/:id/images */

import { api } from '@/lib/api'

export interface UploadImagesResponse {
  images: string[]
}

/**
 * Upload images for a product.
 * Accepts data URLs (jpeg/png/webp) or https URLs.
 * Max 5 images, 1 MB each.
 * Throws ApiError with IMAGE_TOO_LARGE / MAX_IMAGES_EXCEEDED on violation.
 */
export async function uploadProductImages(
  productId: string,
  dataUrls: string[],
  signal?: AbortSignal,
): Promise<UploadImagesResponse> {
  return api<UploadImagesResponse>(`/products/${productId}/images`, {
    method: 'POST',
    body: JSON.stringify({ images: dataUrls }),
    signal,
    entityType: 'product-image',
    entityLabel: 'Product images',
  })
}
