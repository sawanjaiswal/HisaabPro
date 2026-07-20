/** Payment form body — shared by Record and Edit (mockup #7).
 *
 * One continuous scroll: the payment details are always visible; invoice
 * linking and discount collapse. Composed once so the two pages cannot drift.
 */

import { useState } from 'react'
import { FormSection } from '@/components/ui/FormSection'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { useLanguage } from '@/hooks/useLanguage'
import { calculateSettlement, calculateUnallocatedAmount } from '../payment.utils'
import { PaymentDetailsSection } from './PaymentDetailsSection'
import { PaymentInvoicesSection } from './PaymentInvoicesSection'
import { PaymentDiscountSection } from './PaymentDiscountSection'
import type { usePaymentForm } from '../usePaymentForm'

type PaymentForm = ReturnType<typeof usePaymentForm>

interface PaymentFormSectionsProps {
  form: PaymentForm['form']
  errors: Record<string, string>
  updateField: PaymentForm['updateField']
  updateMode: PaymentForm['updateMode']
  toggleAllocation: PaymentForm['toggleAllocation']
  updateAllocationAmount: PaymentForm['updateAllocationAmount']
  autoAllocate: PaymentForm['autoAllocate']
  toggleDiscount: PaymentForm['toggleDiscount']
  updateDiscount: PaymentForm['updateDiscount']
}

export function PaymentFormSections({
  form,
  errors,
  updateField,
  updateMode,
  toggleAllocation,
  updateAllocationAmount,
  autoAllocate,
  toggleDiscount,
  updateDiscount,
}: PaymentFormSectionsProps) {
  const { t } = useLanguage()
  const settlement = calculateSettlement(form.amount, form.discount)
  const unallocated = calculateUnallocatedAmount(
    form.amount,
    form.allocations.filter((a) => a.selected),
  )

  /** Open on the state the user already committed to: an existing discount, or
   *  allocations they picked. Errors in either force it open — a message inside
   *  a collapsed block would be unreachable. */
  const [openSections, setOpenSections] = useState<string[]>(() => {
    const initial: string[] = []
    if (form.allocations.some((a) => a.selected)) initial.push('invoices')
    if (form.discount) initial.push('discount')
    return initial
  })

  const forced: string[] = []
  if (errors.allocations && !openSections.includes('invoices')) forced.push('invoices')
  if (errors.discount && !openSections.includes('discount')) forced.push('discount')

  return (
    <>
      <FormSection title={t.sectionDetails}>
        <PaymentDetailsSection
          partyId={form.partyId}
          amount={form.amount}
          date={form.date}
          mode={form.mode}
          referenceNumber={form.referenceNumber}
          notes={form.notes}
          errors={errors}
          onPartyChange={(id) => updateField('partyId', id)}
          onAmountChange={(paise) => updateField('amount', paise)}
          onDateChange={(d) => updateField('date', d)}
          onModeChange={updateMode}
          onReferenceChange={(ref) => updateField('referenceNumber', ref)}
          onNotesChange={(n) => updateField('notes', n)}
        />
      </FormSection>

      <Accordion
        type="multiple"
        className="form-accordion"
        value={[...openSections, ...forced]}
        onValueChange={setOpenSections}
      >
        <AccordionItem value="invoices">
          <AccordionTrigger>{t.sectionLinkInvoices}</AccordionTrigger>
          <AccordionContent>
            <PaymentInvoicesSection
              allocations={form.allocations}
              unallocatedAmount={unallocated}
              errors={errors}
              onToggle={toggleAllocation}
              onAmountChange={updateAllocationAmount}
              onAutoAllocate={autoAllocate}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="discount">
          <AccordionTrigger>{t.discount}</AccordionTrigger>
          <AccordionContent>
            <PaymentDiscountSection
              discount={form.discount}
              amount={form.amount}
              settlement={settlement}
              errors={errors}
              onToggle={toggleDiscount}
              onUpdate={updateDiscount}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  )
}
