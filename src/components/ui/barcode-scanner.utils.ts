/** Barcode Scanner — platform scan helpers (lazy-imported) */

/** Native scan via @capacitor-mlkit/barcode-scanning */
export async function scanNative(
  onScan: (v: string) => void,
  onError: (msg: string) => void,
  onCancel: () => void,
): Promise<void> {
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')

  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
  if (!available) {
    try {
      await BarcodeScanner.installGoogleBarcodeScannerModule()
    } catch {
      onError('Scanner unavailable offline. Type barcode below.')
      return
    }
  }

  const { camera } = await BarcodeScanner.requestPermissions()
  if (camera !== 'granted' && camera !== 'limited') {
    onError('Camera permission denied. Go to Settings > HisaabPro > Camera to allow.')
    return
  }

  try {
    const result = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.UpcA,
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
        BarcodeFormat.QrCode,
      ],
    })
    if (result.barcodes.length > 0 && result.barcodes[0].rawValue) {
      onScan(result.barcodes[0].rawValue)
    } else {
      onCancel()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user')) {
      onCancel()
    } else {
      onError('No barcode found. Try again or enter manually.')
    }
  }
}

/** Web scan via @zxing/browser (lazy-imported) */
export async function scanWeb(
  file: File,
  onScan: (v: string) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const reader = new BrowserMultiFormatReader()
  let objectUrl: string | null = null
  try {
    objectUrl = URL.createObjectURL(file)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = objectUrl!
    })
    const result = await reader.decodeFromImageElement(img)
    onScan(result.getText())
  } catch {
    onError('No barcode found in image. Try a clearer photo or enter below.')
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}
