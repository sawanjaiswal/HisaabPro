/** Create Invoice — the collapsible Details / Charges sections (mockup #2).
 *
 * Mockup #2 is one continuous scroll: Customer and Items stay visible and the
 * optional sections collapse rather than hiding behind tabs, so nothing that
 * used to be reachable stops being reachable.
 */

import React from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { useLanguage } from '@/hooks/useLanguage'
import { InvoiceDetailsSection } from './InvoiceDetailsSection'
import { InvoiceCustomFieldsSection } from './InvoiceCustomFieldsSection'
import { InvoiceChargesSection } from './InvoiceChargesSection'
import type { DocumentFormData, AdditionalChargeFormData } from '../invoice.types'

interface InvoiceOptionalSectionsProps {
  form: DocumentFormData
  openSections: string[]
  onOpenSectionsChange: (value: string[]) => void
  onUpdateField: <K extends keyof DocumentFormData>(key: K, value: DocumentFormData[K]) => void
  onAddCharge: (charge: AdditionalChargeFormData) => void
  onUpdateCharge: (index: number, charge: Partial<AdditionalChargeFormData>) => void
  onRemoveCharge: (index: number) => void
  /** Hide the date field inside Details when it's surfaced by InvoiceHeaderMeta. */
  hideDate?: boolean
}

export const InvoiceOptionalSections: React.FC<InvoiceOptionalSectionsProps> = ({
  form,
  openSections,
  onOpenSectionsChange,
  onUpdateField,
  onAddCharge,
  onUpdateCharge,
  onRemoveCharge,
  hideDate = false,
}) => {
  const { t } = useLanguage()

  return (
    <Accordion
      type="multiple"
      className="form-accordion"
      value={openSections}
      onValueChange={onOpenSectionsChange}
    >
      <AccordionItem value="details">
        <AccordionTrigger>{t.sectionDetails}</AccordionTrigger>
        <AccordionContent className="space-y-6">
          <InvoiceDetailsSection
            documentDate={form.documentDate}
            paymentTerms={form.paymentTerms}
            vehicleNumber={form.vehicleNumber ?? ''}
            notes={form.notes ?? ''}
            termsAndConditions={form.termsAndConditions ?? ''}
            includeSignature={form.includeSignature}
            hideDate={hideDate}
            onUpdateField={onUpdateField}
          />
          <InvoiceCustomFieldsSection
            documentType={form.type}
            values={(form.customFieldValues ?? {}) as Record<string, unknown>}
            errors={{}}
            onChange={(v) => onUpdateField('customFieldValues', v)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="charges">
        <AccordionTrigger>{t.chargesLabel}</AccordionTrigger>
        <AccordionContent>
          <InvoiceChargesSection
            charges={form.additionalCharges}
            onUpdateCharge={onUpdateCharge}
            onRemoveCharge={onRemoveCharge}
            onAddCharge={onAddCharge}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
