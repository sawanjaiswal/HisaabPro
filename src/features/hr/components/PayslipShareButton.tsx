/** PayslipShareButton — Phase 6 PR6 FE
 *
 * Shares the rendered payslip PDF. Strategy:
 *
 *   1. Render the React-PDF Document to a Blob via `pdf(<Doc/>).toBlob()`.
 *   2. If `navigator.canShare({ files: [<File>] })` returns true → use
 *      `navigator.share({ files })` for a native share-sheet (Android
 *      WebView on Chrome supports this since Capacitor 8 + Chrome 89).
 *   3. Else if `navigator.share` exists but can't share files → use
 *      `navigator.share({ text, url })` with a wa.me deeplink.
 *   4. Else fall back to a plain WhatsApp deeplink in a new tab.
 *
 * `@capacitor/share` is intentionally NOT installed — `navigator.share`
 * works on Android WebView (Capacitor 8) without an extra dep. iOS will
 * pick this up automatically when iOS shell is added later.
 *
 * Phone: prefer the employee's phone (digits only); if absent, share to
 * a chooser (no recipient pre-fill).
 */

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { PayslipPDF, type PayslipPDFLabels } from './PayslipPDF'
import type { PayslipSnapshotPayload } from '../payroll.types'

interface PayslipShareButtonProps {
  snapshot: PayslipSnapshotPayload
  pdfLabels: PayslipPDFLabels
}

function buildWaUrl(phoneE164: string | null | undefined, text: string): string {
  const digits = (phoneE164 ?? '').replace(/\D/g, '')
  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function PayslipShareButton({ snapshot, pdfLabels }: PayslipShareButtonProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    setBusy(true)
    try {
      const blob = await pdf(<PayslipPDF snapshot={snapshot} labels={pdfLabels} />).toBlob()
      const filename = `payslip-${snapshot.employee.name.replace(/\s+/g, '_')}-${snapshot.period.fromDate}_to_${snapshot.period.toDate}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })

      const shareText = (t.payslipShareText as string)
        .replace('{name}', snapshot.employee.name)
        .replace('{from}', snapshot.period.fromDate)
        .replace('{to}', snapshot.period.toDate)

      // 1. Native files share
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
      }
      if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: pdfLabels.payslipTitle, text: shareText })
        return
      }

      // 2. Native text/url share — open file in a new tab so the user can attach manually
      if (typeof nav.share === 'function') {
        const blobUrl = URL.createObjectURL(blob)
        // Open the PDF so the user can save it before sharing the link
        window.open(blobUrl, '_blank', 'noopener,noreferrer')
        await nav.share({ title: pdfLabels.payslipTitle, text: shareText })
        // We can't revoke immediately — the new tab still needs it.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
        return
      }

      // 3. WhatsApp deeplink fallback
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      window.open(buildWaUrl(snapshot.employee.phone, shareText), '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (err) {
      // Aborted shares throw AbortError — silently ignore.
      const name = (err as Error)?.name
      if (name === 'AbortError') return
      toast.error(t.payslipShareErrorToast as string)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="primary"
      size="md"
      onClick={handleShare}
      loading={busy}
      className="flex-1"
    >
      <Share2 size={18} aria-hidden="true" className="inline-block mr-1" />
      {t.payslipShareCta as string}
    </Button>
  )
}
