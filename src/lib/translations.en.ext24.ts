// ─── HisaabPro — English Ext 24 (Catalog Enrichment — MOQ, Images, Ledger) ───

export const enExt24 = {
  // ─── MOQ ─────────────────────────────────────────────────────────────────
  moqLabel:                'Minimum Order Qty (MOQ)',
  moqHint:                 'Blocks sales below this quantity',
  moqHelperText:           'Block sales below this quantity. Leave 0 for no limit.',
  moqBadgePrefix:          'Min:',

  // ─── Product images ───────────────────────────────────────────────────────
  productImagesLabel:      'Product Images',
  productImages:           'Product images',
  productImagesList:       'Product images list',
  productImage:            'Product image',
  primaryImage:            'Primary image',
  primary:                 'Primary',
  imageActions:            'Image actions',
  moveImageUp:             'Move image up (make primary)',
  moveImageDown:           'Move image down',
  deleteImage:             'Delete image',
  addFromGallery:          'Add from gallery',
  addFromCamera:           'Add from camera',
  gallery:                 'Gallery',
  camera:                  'Camera',
  processingImage:         'Processing image…',
  imageProcessingFailed:   'Image processing failed',
  imageMaxReached:         'Max {max} images allowed',
  imageUploaderHint:       '{count}/{max} images. First image is the primary thumbnail.',

  // ─── Document settings ────────────────────────────────────────────────────
  documentSettingsTitle:   'Document Settings',
  enforceMoqLabel:         'Enforce Minimum Order Quantity',
  enforceMoqDesc:          'Block sales where quantity is below product MOQ',
  showLineItemImagesLabel: 'Show Product Images on Invoice',
  showLineItemImagesDesc:  'Display product thumbnail next to each line item',

  // ─── Party ledger ─────────────────────────────────────────────────────────
  ledgerTab:               'Ledger',
  ledgerEmptyTitle:        'No transactions',
  ledgerEmptyBody:         'No entries found for the selected date range and filters.',
  ledgerErrorTitle:        'Could not load ledger',
  ledgerTable:             'Ledger',
  ledgerTableAriaLabel:    'Party account ledger table',
  ledgerSummary:           'Ledger summary',
  ledgerFromDate:          'Ledger from date',
  ledgerToDate:            'Ledger to date',
  ledgerDownloaded:        'Ledger downloaded',
  ledgerExportFailed:      'Failed to export ledger',
  filterByVoucherType:     'Filter by voucher type',
  downloadLedgerPDF:       'Download ledger as PDF',
  downloadPdf:             'Download PDF',
  loadMoreRows:            'Load more ledger rows',
  remaining:               'remaining',
  exporting:               'Exporting…',

  // ─── Generic ledger labels ────────────────────────────────────────────────
  particulars:             'Particulars',
  voucherType:             'Type',
  drLabel:                 'Debit',
  crLabel:                 'Credit',
  balance:                 'Balance',
  openingBalance:          'Opening Balance',
  closingBalance:          'Closing Balance',
} as const
