/**
 * Multer config for /api/imports — in-memory single-file uploads bounded
 * to MAX_FILE_SIZE_BYTES. Memory storage is required because the parser
 * + zip-bomb + XXE pre-scans all read the buffer directly; disk staging
 * would just add I/O and a tmp-cleanup race for files that are already
 * capped at 10 MB.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md (10 MB cap)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3.1 (mounted AFTER
 *     requireNoActiveJob so the buffer is never read for rejected jobs)
 */

import multer from 'multer'
import { MAX_FILE_SIZE_BYTES } from '../../constants/import.constants.js'

export const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 8,
  },
})
