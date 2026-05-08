/** Product image upload utilities — resize, validate, pick from camera/gallery */

const MAX_DIM = 800
const QUALITY = 0.85
export const MAX_BYTES = 1_048_576 // 1 MB

/**
 * Resize a data URL image to maxDim × maxDim (preserving aspect ratio)
 * using an offscreen HTMLCanvasElement. Returns a JPEG data URL.
 */
export function resizeImage(
  dataUrl: string,
  maxDim = MAX_DIM,
  quality = QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxDim / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Validate that a data URL does not exceed maxBytes when decoded.
 * Returns an error message string or null if valid.
 */
export function validateImageSize(
  dataUrl: string,
  maxBytes = MAX_BYTES,
): string | null {
  // data:[mime];base64,[data]  — base64 payload is after the comma
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 'Invalid image data'
  const base64 = dataUrl.slice(comma + 1)
  // Each base64 char encodes 6 bits; 4 chars = 3 bytes
  const bytes = Math.ceil((base64.length * 3) / 4)
  if (bytes > maxBytes) {
    const kb = Math.round(bytes / 1024)
    return `Image is ${kb} KB — max allowed is ${Math.round(maxBytes / 1024)} KB`
  }
  return null
}

/**
 * Pick one or more images from the device gallery.
 * Falls back to <input type="file"> when Capacitor Camera is unavailable.
 */
export async function pickFromGallery(): Promise<string[]> {
  // Try Capacitor Camera plugin if available
  try {
    // Dynamic import — falls back gracefully when running in web/desktop
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importFn = new Function('pkg', 'return import(pkg)') as (pkg: string) => Promise<any>
    const cap = await importFn('@capacitor/camera').catch(() => null)
    if (cap) {
      const { Camera, CameraResultType, CameraSource } = cap
      const result = await Camera.pickImages({
        quality: 90,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result.photos ?? []).map((p: any) => p.dataUrl as string).filter(Boolean)
    }
  } catch { /* no-op */ }
  // Fallback: file input (web / desktop)
  return pickViaFileInput('image/*', true)
}

/**
 * Capture one image from the device camera.
 * Falls back to <input type="file" capture="environment"> on web.
 */
export async function pickFromCamera(): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importFn2 = new Function('pkg', 'return import(pkg)') as (pkg: string) => Promise<any>
    const cap = await importFn2('@capacitor/camera').catch(() => null)
    if (cap) {
      const { Camera, CameraResultType, CameraSource } = cap
      const photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      })
      return photo.dataUrl ? [photo.dataUrl as string] : []
    }
  } catch { /* no-op */ }
  return pickViaFileInput('image/*', false, true)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function pickViaFileInput(
  accept: string,
  multiple = false,
  capture = false,
): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (multiple) input.multiple = true
    if (capture) input.setAttribute('capture', 'environment')

    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      if (!files.length) { resolve([]); return }
      Promise.all(
        files.map(
          (f) =>
            new Promise<string>((res, rej) => {
              const reader = new FileReader()
              reader.onload = () => res(reader.result as string)
              reader.onerror = rej
              reader.readAsDataURL(f)
            }),
        ),
      ).then(resolve).catch(() => resolve([]))
    }

    input.click()
  })
}
