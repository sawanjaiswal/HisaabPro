// ─── HisaabPro — Hindi Ext 24 (Catalog Enrichment — MOQ, Images, Ledger) ────

export const hiExt24 = {
  // ─── MOQ ─────────────────────────────────────────────────────────────────
  moqLabel:                'न्यूनतम ऑर्डर मात्रा (MOQ)',
  moqHint:                 'इस मात्रा से कम की बिक्री रोकता है',
  moqHelperText:           'इस मात्रा से कम की बिक्री रोकें। कोई सीमा नहीं के लिए 0 छोड़ें।',
  moqBadgePrefix:          'न्यूनतम:',

  // ─── Product images ───────────────────────────────────────────────────────
  productImagesLabel:      'उत्पाद चित्र',
  productImages:           'उत्पाद चित्र',
  productImagesList:       'उत्पाद चित्र सूची',
  productImage:            'उत्पाद चित्र',
  primaryImage:            'मुख्य चित्र',
  primary:                 'मुख्य',
  imageActions:            'चित्र क्रियाएं',
  moveImageUp:             'चित्र ऊपर ले जाएं (मुख्य बनाएं)',
  moveImageDown:           'चित्र नीचे ले जाएं',
  deleteImage:             'चित्र हटाएं',
  addFromGallery:          'गैलरी से जोड़ें',
  addFromCamera:           'कैमरा से जोड़ें',
  gallery:                 'गैलरी',
  camera:                  'कैमरा',
  processingImage:         'चित्र प्रोसेस हो रहा है…',
  imageProcessingFailed:   'चित्र प्रोसेस विफल',
  imageMaxReached:         'अधिकतम {max} चित्र अनुमत हैं',
  imageUploaderHint:       '{count}/{max} चित्र। पहला चित्र मुख्य थंबनेल है।',

  // ─── Document settings ────────────────────────────────────────────────────
  documentSettingsTitle:   'दस्तावेज़ सेटिंग',
  enforceMoqLabel:         'न्यूनतम ऑर्डर मात्रा लागू करें',
  enforceMoqDesc:          'MOQ से कम मात्रा पर बिक्री रोकें',
  showLineItemImagesLabel: 'चालान पर उत्पाद चित्र दिखाएं',
  showLineItemImagesDesc:  'प्रत्येक पंक्ति आइटम के पास उत्पाद थंबनेल दिखाएं',

  // ─── Party ledger ─────────────────────────────────────────────────────────
  ledgerTab:               'खाता बही',
  ledgerEmptyTitle:        'कोई लेनदेन नहीं',
  ledgerEmptyBody:         'चुनी गई तिथि सीमा और फ़िल्टर के लिए कोई प्रविष्टि नहीं मिली।',
  ledgerErrorTitle:        'खाता बही लोड नहीं हुई',
  ledgerTable:             'खाता बही',
  ledgerTableAriaLabel:    'पार्टी खाता बही तालिका',
  ledgerSummary:           'खाता बही सारांश',
  ledgerFromDate:          'खाता बही से तारीख',
  ledgerToDate:            'खाता बही तक तारीख',
  ledgerDownloaded:        'खाता बही डाउनलोड हुई',
  ledgerExportFailed:      'खाता बही निर्यात विफल',
  filterByVoucherType:     'वाउचर प्रकार से फ़िल्टर करें',
  downloadLedgerPDF:       'खाता बही PDF डाउनलोड करें',
  downloadPdf:             'PDF डाउनलोड करें',
  loadMoreRows:            'और पंक्तियां लोड करें',
  remaining:               'शेष',
  exporting:               'निर्यात हो रहा है…',

  // ─── Generic ledger labels ────────────────────────────────────────────────
  particulars:             'विवरण',
  voucherType:             'प्रकार',
  drLabel:                 'डेबिट',
  crLabel:                 'क्रेडिट',
  balance:                 'शेषराशि',
  openingBalance:          'प्रारंभिक शेष',
  closingBalance:          'समापन शेष',
} as const
