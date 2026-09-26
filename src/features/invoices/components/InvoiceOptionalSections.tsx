import React from 'react'
import { FileText, Percent } from 'lucide-react'
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
      className="space-y-6"
      value={openSections}
      onValueChange={onOpenSectionsChange}
    >
      <AccordionItem
        value="details"
        className="bg-white rounded-[8px] p-4 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.07),0_1px_4px_-1px_rgba(0,0,0,0.04)] border border-gray-100/80 transition-all"
      >
        <AccordionTrigger className="flex items-center justify-between py-0 hover:no-underline cursor-pointer">
          <div className="flex items-center gap-2.5 text-left">
            <FileText className="w-4 h-4 text-[#026F39] shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-slate-900">
                {t.sectionDetails || 'Details'}
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Notes, reference, due date etc.
              </span>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 space-y-6">
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

      <AccordionItem
        value="charges"
        className="bg-white rounded-[8px] p-4 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.07),0_1px_4px_-1px_rgba(0,0,0,0.04)] border border-gray-100/80 transition-all"
      >
        <AccordionTrigger className="flex items-center justify-between py-0 hover:no-underline cursor-pointer">
          <div className="flex items-center gap-2.5 text-left">
            <Percent className="w-4 h-4 text-[#026F39] shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-slate-900">
                {t.chargesLabel || 'Charges'}
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Discount, tax and other charges
              </span>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4">
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
