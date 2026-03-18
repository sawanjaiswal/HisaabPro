/** Bill Scanning / OCR — Constants */

/** Max image dimension before OCR (prevents OOM on cheap phones) */
export const MAX_IMAGE_DIMENSION = 2000

/** Max file size in bytes (4MB) */
export const MAX_FILE_SIZE = 4 * 1024 * 1024

/** Confidence thresholds for badge colors */
export const CONFIDENCE_HIGH = 70
export const CONFIDENCE_MEDIUM = 40

/** Max items to extract from a single scan */
export const MAX_EXTRACTED_ITEMS = 50

/** Supported image MIME types */
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'

/** Accepted file extensions for input */
export const ACCEPTED_IMAGE_EXTENSIONS = '.jpg,.jpeg,.png,.webp'

/** OCR language */
export const OCR_LANGUAGE = 'eng'
