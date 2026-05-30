/** PartyPickerField — adapter that lets CreateAppointmentDrawer reuse the
 *  shared `<PartySearchInput>` typeahead with appointment-form state.
 *
 *  The shared component is opinionated: it ships its own label ("Customer /
 *  Supplier") and a hardcoded English placeholder. Until that surface gains
 *  i18n props (separate epic), we wrap it in a thin label override.
 *
 *  When the user clears the picker, both id and display name are emptied so
 *  the form's `partyId`/`partyName` mirror snapshot semantics: the value the
 *  user saw at submit time is what goes to `partyNameSnapshot`.
 */

import { PartySearchInput } from '@/components/ui/PartySearch'
import { useLanguage } from '@/hooks/useLanguage'

interface PartyPickerFieldProps {
  partyId: string
  partyName: string
  onChange: (id: string, name: string) => void
  error?: string
}

export function PartyPickerField({ partyId, onChange, error }: PartyPickerFieldProps) {
  const { t } = useLanguage()
  // The wrapped component renders its own "Customer / Supplier" label. We
  // place a heading above it so the user sees the appointment-context label
  // (Hindi/English). The wrapped <label> stays for screen-reader semantics.
  return (
    <div>
      <div
        className="text-[var(--fs-sm)] mb-1.5"
        style={{ color: 'var(--color-text)' }}
      >
        {t.pickParty ?? 'Pick a party'}
      </div>
      <PartySearchInput
        value={partyId}
        onChange={onChange}
        error={error}
      />
    </div>
  )
}
