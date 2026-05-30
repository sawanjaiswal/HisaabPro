/** Cash Register — Optional note textarea */

import { MAX_NOTE_LEN } from '../cashRegister.constants'
import { Textarea } from '@/components/ui/Textarea'

interface Props {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export function NoteField({ value, onChange, disabled }: Props) {
  const remaining = MAX_NOTE_LEN - value.length

  return (
    <div className="cr-note">
      <label htmlFor="cr-note-input" className="cr-note__label">
        Add note (optional)
      </label>
      <Textarea
        id="cr-note-input"
        className="cr-note__textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_NOTE_LEN}
        placeholder="e.g. delivery, rent, misc"
        rows={2}
        disabled={disabled}
        aria-describedby="cr-note-counter"
      />
      {value.length > 200 && (
        <span id="cr-note-counter" className="cr-note__counter" aria-live="polite">
          {remaining} chars left
        </span>
      )}
    </div>
  )
}
