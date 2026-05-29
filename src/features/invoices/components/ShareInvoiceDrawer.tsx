/** Share Invoice Drawer
 *
 * Bottom sheet with 4 share actions: WhatsApp · PDF Download · Copy Link · Print.
 * Handlers live in ./useShareInvoice.
 *
 * All monetary values in PAISE — display via formatInvoiceAmount.
 */

import { useState, useMemo } from 'react'
import { MessageCircle, Download, Link, Printer, FileText, Mail } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { useTemplates } from '@/features/templates/useTemplates'
import { ShareActionRow } from './ShareActionRow'
import { useShareInvoice } from './useShareInvoice'
import { ShareLinksSection } from './ShareLinksSection'
import { EmailShareForm } from './EmailShareForm'
import type { DocumentDetail } from '../invoice-document.types'
import '../invoice-detail-share-drawer.css'

export interface ShareInvoiceDrawerProps {
  open: boolean
  onClose: () => void
  documentId: string
  documentNumber: string
  partyName: string
  /** Party's phone number (raw — may be +91XXXXXXXXXX or 0XXXXXXXXXX or 10 digits) */
  partyPhone?: string
  /** Grand total in PAISE */
  grandTotal: number
  /** Full document — enables the Email-PDF action (#32). Omit to hide it. */
  document?: DocumentDetail
}

export function ShareInvoiceDrawer({
  open,
  onClose,
  documentId,
  documentNumber,
  partyName,
  partyPhone,
  grandTotal,
  document: doc,
}: ShareInvoiceDrawerProps) {
  const { t } = useLanguage()
  const [view, setView] = useState<'actions' | 'email'>('actions')
  const { templates } = useTemplates()
  const defaultTemplateId = useMemo(
    () =>
      templates.find((tpl) => tpl.defaultForTypes.includes('SALE_INVOICE'))?.id ??
      templates.find((tpl) => tpl.isDefault)?.id ??
      templates[0]?.id ??
      '',
    [templates]
  )
  const [templateId, setTemplateId] = useState<string>('')
  const activeTemplateId = templateId || defaultTemplateId

  const { loading, handleWhatsApp, handlePdfDownload, handleCopyLink, handlePrint, handleEmail } = useShareInvoice({
    documentId,
    documentNumber,
    partyName,
    partyPhone,
    grandTotal,
    activeTemplateId,
    document: doc,
    onClose,
  })

  const isDisabled = loading !== null

  const close = () => { setView('actions'); onClose() }

  return (
    <Drawer open={open} onClose={close} title={t.shareInvoice} size="sm">
      {view === 'email' && doc ? (
        <EmailShareForm
          documentNumber={documentNumber}
          partyName={partyName}
          isSending={loading === 'email'}
          onSend={(email, subject, body) => { void handleEmail(email, subject, body) }}
          onBack={() => setView('actions')}
        />
      ) : (
      <>
      {templates.length > 1 && (
        <div className="share-template-picker">
          <label htmlFor="share-template-select" className="share-template-picker-label">
            <FileText size={16} aria-hidden="true" />
            {t.template}
          </label>
          <select
            id="share-template-select"
            className="share-template-picker-select"
            value={activeTemplateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={isDisabled}
            aria-label={t.chooseTemplate}
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
                {tpl.defaultForTypes.includes('SALE_INVOICE') ? ` · ${t.defaultLabel}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <ul className="share-action-list" role="list" aria-label={t.shareOptionsAriaLabel}>
        <ShareActionRow
          icon={<MessageCircle size={22} aria-hidden="true" />}
          label={t.shareViaWhatsAppLabel}
          subLabel={partyPhone}
          onClick={() => { void handleWhatsApp() }}
          isLoading={loading === 'whatsapp'}
          disabled={isDisabled}
          ariaLabel={t.shareInvoiceViaWhatsApp}
          iconModifier="whatsapp"
        />
        <ShareActionRow
          icon={<Download size={22} aria-hidden="true" />}
          label={t.downloadPdfLabel}
          subLabel={t.savePdfFile}
          onClick={() => { void handlePdfDownload() }}
          isLoading={loading === 'pdf'}
          disabled={isDisabled}
          ariaLabel={t.downloadInvoicePdf}
          iconModifier="pdf"
        />
        {doc && (
          <ShareActionRow
            icon={<Mail size={22} aria-hidden="true" />}
            label={t.emailInvoice}
            subLabel={t.sendPdfByEmail}
            onClick={() => setView('email')}
            isLoading={loading === 'email'}
            disabled={isDisabled}
            ariaLabel={t.emailInvoice}
            iconModifier="link"
          />
        )}
        <ShareActionRow
          icon={<Link size={22} aria-hidden="true" />}
          label={t.copySharLink}
          subLabel={t.anyoneCanView}
          onClick={() => { void handleCopyLink() }}
          isLoading={loading === 'link'}
          disabled={isDisabled}
          ariaLabel={t.copyLinkClipboard}
          iconModifier="link"
        />
        <ShareActionRow
          icon={<Printer size={22} aria-hidden="true" />}
          label={t.printInvoice}
          subLabel={t.openPrintDialog}
          onClick={() => { void handlePrint() }}
          isLoading={false}
          disabled={isDisabled}
          ariaLabel={t.printInvoiceAriaLabel}
          iconModifier="print"
          isLast
        />
      </ul>

      <ShareLinksSection documentId={documentId} documentNumber={documentNumber} />
      </>
      )}
    </Drawer>
  )
}
