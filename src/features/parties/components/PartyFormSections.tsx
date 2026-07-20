/** Party form body — shared by Create and Edit (mockup #6).
 *
 * One continuous scroll: identity fields always visible, optional blocks
 * collapsed. Lives here rather than in each page so the two cannot diverge.
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
import { PartyFormBasic } from './PartyFormBasic'
import { PartyFormBusiness } from './PartyFormBusiness'
import { PartyFormCredit } from './PartyFormCredit'
import { PartyFormCustomFields } from './PartyFormCustomFields'
import type { PartyFormData } from '../party.types'
import type { usePartyForm } from '../usePartyForm'

interface PartyFormSectionsProps {
  form: PartyFormData
  errors: Record<string, string>
  onUpdate: ReturnType<typeof usePartyForm>['updateField']
  gstinVerify: ReturnType<typeof usePartyForm>['gstinVerify']
  isEditMode?: boolean
}

export function PartyFormSections({
  form,
  errors,
  onUpdate,
  gstinVerify,
  isEditMode = false,
}: PartyFormSectionsProps) {
  const { t } = useLanguage()
  const [openSections, setOpenSections] = useState<string[]>([])

  /** A validation error inside a collapsed block would be unreachable — force
   *  that block open while the error stands. */
  const forced: string[] = []
  if (errors.gstin && !openSections.includes('business')) forced.push('business')
  if (errors.creditLimit && !openSections.includes('credit')) forced.push('credit')

  return (
    <>
      <FormSection title={t.basicInfo}>
        <PartyFormBasic form={form} errors={errors} onUpdate={onUpdate} isEditMode={isEditMode} />
      </FormSection>

      <Accordion
        type="multiple"
        className="form-accordion"
        value={[...openSections, ...forced]}
        onValueChange={setOpenSections}
      >
        <AccordionItem value="business">
          <AccordionTrigger>{t.business2}</AccordionTrigger>
          <AccordionContent>
            <PartyFormBusiness
              form={form}
              errors={errors}
              onUpdate={onUpdate}
              gstinVerify={gstinVerify}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="credit">
          <AccordionTrigger>{t.credit}</AccordionTrigger>
          <AccordionContent>
            <PartyFormCredit form={form} errors={errors} onUpdate={onUpdate} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="custom">
          <AccordionTrigger>{t.customFields}</AccordionTrigger>
          <AccordionContent>
            <PartyFormCustomFields form={form} onUpdate={onUpdate} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  )
}
