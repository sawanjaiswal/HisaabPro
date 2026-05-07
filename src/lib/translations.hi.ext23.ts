// ─── HisaabPro — Hindi Ext 23 (POS Billing Mode — PR10+PR11) ────────────────

export const hiExt23 = {
  // ─── Page titles ──────────────────────────────────────────────────────────
  posBillingMode:           'POS बिलिंग',
  posSalesHistory:          'बिक्री इतिहास',
  posSaleDetail:            'बिक्री विवरण',
  posReceiptTitle:          'रसीद',

  // ─── Nav ──────────────────────────────────────────────────────────────────
  posNavLabel:              'POS',

  // ─── Cart ─────────────────────────────────────────────────────────────────
  posCart:                  'कार्ट',
  posCartItems:             'कार्ट आइटम',
  posCartEmptyTitle:        'कार्ट खाली है',
  posCartEmptyBody:         'कार्ट में जोड़ने के लिए किसी उत्पाद पर टैप करें',
  posSubtotal:              'उप-योग',
  posDiscount:              'छूट',
  posTax:                   'कर',
  posGrandTotal:            'कुल',
  posCheckout:              'चेकआउट',
  posItems:                 'आइटम',
  posItemCount:             '{n} आइटम',
  posRemoveItem:            'हटाएं',
  posDecreaseQty:           'मात्रा घटाएं',
  posIncreaseQty:           'मात्रा बढ़ाएं',

  // ─── Product grid ─────────────────────────────────────────────────────────
  posSearchProducts:        'उत्पाद खोजें…',
  posSearchParty:           'नाम या फ़ोन से खोजें…',
  posNoProducts:            'कोई उत्पाद उपलब्ध नहीं',
  posNoProductsSearch:      '"{q}" से मिलते उत्पाद नहीं',
  posProductsError:         'उत्पाद लोड नहीं हो सके',
  posOutOfStock:            'स्टॉक में नहीं',
  posStock:                 'स्टॉक: {n}',

  // ─── Payment modes ────────────────────────────────────────────────────────
  posModeCash:              'नकद',
  posModeUpi:               'UPI',
  posModeCard:              'कार्ड',
  posModeBank:              'बैंक ट्रांसफर',
  posModeCredit:            'उधार',
  posSelectMode:            'भुगतान मोड चुनें',
  posPaymentTitle:          'भुगतान',
  posSplitPayment:          'भुगतान विभाजित करें',
  posChange:                'वापसी',
  posConfirmSale:           'बिक्री पुष्टि करें',
  posProcessing:            'प्रोसेस हो रहा है…',
  posAmountShort:           'भुगतान राशि कुल से कम है',

  // ─── UPI QR ───────────────────────────────────────────────────────────────
  posUpiQrTitle:            'UPI से भुगतान करें',
  posUpiQrHint:             'किसी भी UPI ऐप से स्कैन करें',
  posUpiId:                 'UPI ID',
  posOpenUpiApp:            'UPI ऐप खोलें',
  posPaymentReceived:       'भुगतान प्राप्त',

  // ─── Customer ─────────────────────────────────────────────────────────────
  posCustomerSearch:        'ग्राहक खोजें',
  posWalkIn:                'सामान्य ग्राहक',
  posWalkInOptional:        'ग्राहक विवरण (वैकल्पिक)',
  posWalkInName:            'ग्राहक नाम',
  posWalkInPhone:           'फ़ोन नंबर',
  posCustomerSelected:      'ग्राहक चुना गया',
  posRemoveCustomer:        'ग्राहक हटाएं',
  posCustomer:              'ग्राहक',

  // ─── Void / Restore ───────────────────────────────────────────────────────
  posVoidSale:              'बिक्री रद्द करें',
  posVoidTitle:             'बिक्री रद्द करें',
  posVoidConfirmText:       'बिक्री {receipt} रद्द करें? इससे सभी स्टॉक मूवमेंट वापस होंगे।',
  posVoidReason:            'कारण',
  posVoidReasonPlaceholder: 'कारण दर्ज करें (न्यूनतम 3 अक्षर)',
  posVoidConfirm:           'रद्द करें',
  posVoiding:               'रद्द हो रहा है…',
  posVoided:                'रद्द',
  posVoidSuccess:           'बिक्री रद्द हुई',
  posVoidFailed:            'बिक्री रद्द नहीं हो सकी',
  posRestoreSale:           'बिक्री पुनर्स्थापित करें',
  posRestoring:             'पुनर्स्थापित हो रहा है…',
  posRestoreSuccess:        'बिक्री पुनर्स्थापित हुई',
  posRestoreFailed:         'बिक्री पुनर्स्थापित नहीं हो सकी',

  // ─── History ──────────────────────────────────────────────────────────────
  posHistoryError:          'बिक्री लोड नहीं हो सकी',
  posNoSales:               'अभी तक कोई बिक्री नहीं',
  posSalesCount:            '{n} बिक्री',
  posFilterSales:           'बिक्री फ़िल्टर करें',
  posStatusFilter:          'स्थिति',
  posStatusActive:          'सक्रिय',
  posPaymentModeFilter:     'भुगतान मोड',
  allStatuses:              'सभी स्थितियां',
  allModes:                 'सभी मोड',

  // ─── Sale detail ──────────────────────────────────────────────────────────
  posDate:                  'तारीख',
  posTime:                  'समय',
  posPayments:              'भुगतान',
  posSaleNotFound:          'बिक्री नहीं मिली',
  posViewReceipt:           'रसीद देखें',
  posHideReceipt:           'रसीद छुपाएं',

  // ─── Receipt ──────────────────────────────────────────────────────────────
  posReceiptSize:           'रसीद साइज़',
  posNewSale:               'नई बिक्री',

  // ─── Share ────────────────────────────────────────────────────────────────
  posShareReceipt:          'रसीद शेयर करें',
  posShareWhatsApp:         'WhatsApp',
  posShareEmail:            'ईमेल',
  posDownloadPdf:           'डाउनलोड',
  posPrint:                 'प्रिंट',
  posShareFailed:           'शेयर विफल',

  // ─── Errors ───────────────────────────────────────────────────────────────
  posSaleFailed:            'चेकआउट विफल। पुनः प्रयास करें।',
  posOfflineCheckout:       'बिक्री पूरी करने के लिए इंटरनेट आवश्यक है',
} as const
