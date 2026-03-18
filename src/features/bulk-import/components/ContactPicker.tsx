/** Contact Picker — Choose import method (Contact Picker API or CSV) */

import { useRef } from 'react'
import { Users, FileSpreadsheet } from 'lucide-react'
import { HAS_CONTACT_PICKER, CSV_ACCEPT } from '../bulk-import.constants'

interface ContactPickerProps {
  onPickContacts: () => void
  onImportCsv: (file: File) => void
}

export function ContactPicker({ onPickContacts, onImportCsv }: ContactPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onImportCsv(file)
    e.target.value = ''
  }

  return (
    <div className="bulk-import-picker">
      <div className="bulk-import-illustration" aria-hidden="true">
        <Users size={48} strokeWidth={1.5} />
      </div>

      <h2 className="bulk-import-title">Import Parties</h2>
      <p className="bulk-import-description">
        Add multiple customers or suppliers at once from your phone contacts or a CSV file
      </p>

      <div className="bulk-import-buttons">
        {HAS_CONTACT_PICKER && (
          <button
            type="button"
            className="btn btn-primary btn-lg bulk-import-btn"
            onClick={onPickContacts}
            aria-label="Import from phone contacts"
          >
            <Users size={20} aria-hidden="true" />
            <span>Phone Contacts</span>
          </button>
        )}

        <button
          type="button"
          className={`btn ${HAS_CONTACT_PICKER ? 'btn-secondary' : 'btn-primary'} btn-lg bulk-import-btn`}
          onClick={() => fileRef.current?.click()}
          aria-label="Import from CSV file"
        >
          <FileSpreadsheet size={20} aria-hidden="true" />
          <span>CSV File</span>
        </button>
      </div>

      <p className="bulk-import-hint">
        {HAS_CONTACT_PICKER
          ? 'Select contacts from your phone or upload a CSV with Name and Phone columns'
          : 'Upload a CSV file with "name" and "phone" columns'}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept={CSV_ACCEPT}
        onChange={handleFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
