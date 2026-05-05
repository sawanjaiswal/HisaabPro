/** Invoice Template — QR Code block
 *
 * Renders either the IRN QR (e-invoice) or UPI QR, sized per paper format.
 * IRN QR takes priority when both are present (regulatory requirement).
 * 58mm thermal and 80mm thermal (UPI-only) may suppress the QR entirely.
 *
 * Size table (Architecture §6.5):
 *   A4           → IRN 40mm / UPI 35mm
 *   A5           → IRN 35mm / UPI 30mm
 *   THERMAL_80MM → IRN 30mm / UPI 25mm
 *   THERMAL_58MM → hidden (null)
 *
 * GST Phase 2 / PR 5
 */

import React from 'react'
import type { PageSize } from '../template-layout.types'
import { IRN_QR_SIZE_MM, UPI_QR_SIZE_MM } from '../template.constants'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface QrCodeBlockProps {
  /** Whether the template field is enabled */
  enabled: boolean
  /** Base-64 or data-URI of the IRN QR image (from e-invoice). Null when not an e-invoice. */
  irnQrData: string | null | undefined
  /** Base-64 or data-URI of the UPI QR image. Null when not configured. */
  upiQrData: string | null | undefined
  /** Page size — determines rendered size; 58mm = hidden */
  pageSize: PageSize
  /** Alt text for accessibility */
  altText?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export const QrCodeBlock: React.FC<QrCodeBlockProps> = ({
  enabled,
  irnQrData,
  upiQrData,
  pageSize,
  altText,
}) => {
  if (!enabled) return null

  // IRN wins when both are present (regulatory > convenience)
  const qrData = irnQrData ?? upiQrData
  if (!qrData) return null

  const isIrn = Boolean(irnQrData)
  const sizeMm = isIrn ? IRN_QR_SIZE_MM[pageSize] : UPI_QR_SIZE_MM[pageSize]

  // 0 = hidden (58mm thermal)
  if (sizeMm === 0) return null

  const sizeStyle = `${sizeMm}mm`

  return (
    <img
      src={qrData}
      alt={altText ?? (isIrn ? 'IRN QR Code' : 'UPI QR Code')}
      style={{
        width: sizeStyle,
        height: sizeStyle,
        display: 'block',
      }}
      aria-label={isIrn ? 'E-invoice IRN QR code' : 'UPI payment QR code'}
    />
  )
}
