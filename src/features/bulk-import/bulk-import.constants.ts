/** Bulk Import Parties — Constants */

/** Max contacts to import at once (avoid overwhelming the API) */
export const MAX_BULK_IMPORT = 100

/** Batch size for parallel API calls */
export const IMPORT_BATCH_SIZE = 5

/** Accepted CSV MIME types */
export const CSV_ACCEPT = '.csv,text/csv,application/vnd.ms-excel'

/** Whether the Contact Picker API is available */
export const HAS_CONTACT_PICKER = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window
