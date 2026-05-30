/**
 * StatementPDFPreview — full-screen sheet: period chip + PDF viewer + action bar.
 *
 * 4 UI states: loading | empty (no transactions) | error | success (PDF ready).
 * Share: WhatsApp via wa.me deep link + OS native share (navigator.share).
 * Download: anchor click with blob URL.
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { pdf } from '@react-pdf/renderer'
import { Download, Share2, MessageCircle, RefreshCw, Calendar } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { formatPaise } from '@/lib/format'
import { Drawer } from '@/components/ui/Drawer'
import { StatementPDFTemplate } from './StatementPDFTemplate'
import { StatementPeriodPicker } from './StatementPeriodPicker'
import { useStatement } from './useStatement'

interface Props {
  open: boolean
  onClose: () => void
  partyId: string
  partyName: string
  partyPhone?: string | null
  businessName: string
}

export function StatementPDFPreview({ open, onClose, partyId, partyName, partyPhone, businessName }: Props) {
  const { t } = useLanguage()
  const toast = useToast()

  const [pickerOpen, setPickerOpen] = useState(true)
  const [from, setFrom] = useState<string | undefined>()
  const [to, setTo] = useState<string | undefined>()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const { data, status, refetch } = useStatement(partyId, from, to)

  const handlePeriodConfirm = useCallback((f: string, t2: string) => {
    setFrom(f)
    setTo(t2)
    setPickerOpen(false)
  }, [])

  const buildBlob = useCallback(async () => {
    if (!data) return null
    const doc = <StatementPDFTemplate data={data} />
    return pdf(doc).toBlob()
  }, [data])

  const handleDownload = useCallback(async () => {
    if (!data || isDownloading) return
    setIsDownloading(true)
    try {
      const blob = await buildBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `statement-${partyName.replace(/\s+/g, '-')}-${from}-${to}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      toast.success(t.stmtDownloaded)
    } catch {
      toast.error(t.stmtDownloadFailed)
    } finally {
      setIsDownloading(false)
    }
  }, [data, isDownloading, buildBlob, partyName, from, to, toast, t])

  const handleWhatsApp = useCallback(() => {
    if (!data) return
    const outstanding = formatPaise(data.closingBalancePaise)
    const phone = partyPhone ? partyPhone.replace(/\D/g, '').slice(-10) : ''
    const msg = encodeURIComponent(
      `Hi ${partyName}, please find your account statement attached.\nTotal outstanding: ${outstanding}.\n— ${businessName}`
    )
    const url = phone ? `https://wa.me/91${phone}?text=${msg}` : `https://wa.me/?text=${msg}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [data, partyName, partyPhone, businessName])

  const handleShare = useCallback(async () => {
    if (!data || isSharing) return
    setIsSharing(true)
    try {
      const blob = await buildBlob()
      if (!blob) return
      const file = new File([blob], `statement-${partyName}.pdf`, { type: 'application/pdf' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Account Statement — ${partyName}`,
          text: `Statement from ${businessName}`,
          files: [file],
        })
      } else {
        // Fallback — open PDF in new tab
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(t.stmtShareFailed)
      }
    } finally {
      setIsSharing(false)
    }
  }, [data, isSharing, buildBlob, partyName, businessName, toast, t])

  const periodLabel = from && to ? `${from} — ${to}` : ''

  return (
    <>
      <StatementPeriodPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          if (!from) onClose()
        }}
        onConfirm={handlePeriodConfirm}
        loading={status === 'pending' && Boolean(from)}
      />

      <Drawer
        open={open && !pickerOpen}
        onClose={onClose}
        title={t.stmtTitle}
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%' }}>
            <Button variant="none"
              className="btn btn-outline btn-sm"
              onClick={handleWhatsApp}
              disabled={status !== 'success'}
              aria-label={t.stmtShareWhatsApp}
              style={{ flex: 1 }}
            >
              <MessageCircle size={16} aria-hidden="true" />
              {t.stmtShareWhatsApp}
            </Button>
            <Button variant="none"
              className="btn btn-outline btn-sm"
              onClick={handleShare}
              disabled={status !== 'success' || isSharing}
              aria-label={t.stmtShare}
              style={{ flex: 1 }}
            >
              <Share2 size={16} aria-hidden="true" />
              {isSharing ? t.stmtSharing : t.stmtShare}
            </Button>
            <Button
              variant="primary" size="sm"
              onClick={handleDownload}
              disabled={status !== 'success' || isDownloading}
              aria-label={t.stmtDownload}
              style={{ flex: 1 }}
            >
              <Download size={16} aria-hidden="true" />
              {isDownloading ? t.stmtDownloading : t.stmtDownload}
            </Button>
          </div>
        }
      >
        {/* Period chip */}
        {periodLabel && (
          <Button
            variant="ghost" size="sm"
            onClick={() => setPickerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 'var(--space-4)' }}
            aria-label={t.stmtChangePeriod}
          >
            <Calendar size={14} aria-hidden="true" />
            {periodLabel}
          </Button>
        )}

        {/* Loading */}
        {status === 'pending' && from && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
            <RefreshCw size={32} className="spin" aria-hidden="true" />
            <p>{t.stmtGenerating}</p>
          </div>
        )}

        {/* Empty */}
        {status === 'success' && data && data.transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p>{t.stmtNoTransactions}</p>
            <Button variant="none" className="btn btn-outline btn-sm" onClick={() => setPickerOpen(true)}>
              {t.stmtChangePeriod}
            </Button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p style={{ color: 'var(--color-error)' }}>{t.stmtLoadError}</p>
            <Button variant="none" className="btn btn-outline btn-sm" onClick={() => refetch()}>
              {t.retry}
            </Button>
          </div>
        )}

        {/* Success: PDF preview placeholder (PDFViewer requires iframe, tricky in Drawer) */}
        {status === 'success' && data && data.transactions.length > 0 && (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', textAlign: 'center' }}>
            <p style={{ marginBottom: 4, fontWeight: 600 }}>{t.stmtReadyToDownload}</p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {`${data.transactions.length} ${t.stmtTransactions} · ${t.stmtClosingBalance}: ${formatPaise(data.closingBalancePaise)}`}
            </p>
          </div>
        )}
      </Drawer>
    </>
  )
}
