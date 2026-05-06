// ─── HisaabPro — Hindi Ext 13 (INV-06: Purchase + Alerts + Stock Value) ──────

export const hiExt13 = {
  // ── Purchase list page ────────────────────────────────────────────────────
  purchasesTitle:              'खरीद',
  purchasesEmpty:              'अभी तक कोई खरीद चालान नहीं',
  purchasesEmptyDesc:          'स्टॉक लागत ट्रैक करने के लिए आपूर्तिकर्ताओं से खरीद दर्ज करें',
  createPurchase:              'नई खरीद',
  createPurchaseAriaLabel:     'नया खरीद चालान बनाएं',
  purchaseFilterAll:           'सभी',
  purchaseFilterDraft:         'ड्राफ्ट',
  purchaseFilterSaved:         'सहेजा',
  purchaseListHeading:         'खरीद चालान सूची',
  purchaseFoundSingular:       'खरीद चालान मिला',
  purchaseFoundPlural:         'खरीद चालान मिले',

  // ── Purchase form ─────────────────────────────────────────────────────────
  newPurchase:                 'नई खरीद',
  editPurchase:                'खरीद संपादित करें',
  purchaseFormSections:        'खरीद फॉर्म अनुभाग',
  supplierLabel:               'आपूर्तिकर्ता',
  purchasePriceColLabel:       'खरीद मूल्य',
  stockWillBeAdded:            'सहेजने पर स्टॉक जोड़ा जाएगा',
  savePurchase:                'खरीद सहेजें',
  savingPurchase:              'सहेज रहे हैं...',
  savePurchaseDraft:           'ड्राफ्ट सहेजें',
  purchaseSaved:               'खरीद सहेजी। स्टॉक अपडेट हुआ।',
  purchaseDraftSaved:          'ड्राफ्ट सहेजा।',
  purchaseUpdated:             'खरीद अपडेट हुई। स्टॉक समायोजित।',
  failedSavePurchase:          'खरीद सहेजने में विफल। पुनः प्रयास करें।',
  purchaseDetailTitle:         'खरीद विवरण',
  purchaseVoided:              'खरीद रद्द की गई।',
  voidPurchase:                'खरीद रद्द करें',
  voidPurchaseDesc:            'इससे स्टॉक प्रविष्टि उलट जाएगी। जारी रखें?',
  confirmVoid:                 'हाँ, रद्द करें',
  purchaseSupplierHint:        'आपूर्तिकर्ता चुनें या नया बनाएं',

  // ── Stock alerts page ─────────────────────────────────────────────────────
  stockAlertsTitle:            'कम स्टॉक अलर्ट',
  stockAlertsEmpty:            'सभी आइटम पर्याप्त स्टॉक में हैं',
  stockAlertsEmptyDesc:        'जब उत्पाद न्यूनतम स्तर से नीचे गिरेंगे, तो यहाँ अलर्ट दिखेंगे।',
  dismissAlert:                'खारिज करें',
  dismissingAlert:             'खारिज हो रहा है...',
  alertDismissed:              'अलर्ट खारिज किया।',
  alertDismissFailed:          'अलर्ट खारिज करने में विफल।',
  alertProduct:                'उत्पाद',
  alertCurrentStock:           'वर्तमान स्टॉक',
  alertMinLevel:               'न्यूनतम स्तर',
  alertShortfall:              'कमी',
  alertReorderQty:             'पुनर्ऑर्डर मात्रा',
  alertType:                   'अलर्ट',
  alertTypeLowStock:           'कम',
  alertTypeOutOfStock:         'खत्म',
  lowStockPill:                'कम',
  outOfStockPill:              'खत्म',
  couldNotLoadAlerts:          'अलर्ट लोड नहीं हो सके',
  stockAlertsHeading:          'स्टॉक अलर्ट सूची',

  // ── Stock value report ────────────────────────────────────────────────────
  stockValueReportTitle:       'स्टॉक मूल्य रिपोर्ट',
  stockValueReportEmpty:       'मूल्यांकन के लिए कोई स्टॉक नहीं',
  stockValueReportEmptyDesc:   'स्टॉक मूल्य देखने के लिए उत्पाद जोड़ें और खरीद दर्ज करें।',
  couldNotLoadStockValue:      'स्टॉक मूल्य रिपोर्ट लोड नहीं हुई',
  totalStockValueLabel:        'कुल स्टॉक मूल्य',
  productCountLabel:           'उत्पाद',
  avgCostLabel:                'औसत लागत',
  stockValueLabel:             'मूल्य',
  loadMoreProducts:            'और लोड करें',

  // ── Stock adjust modal ────────────────────────────────────────────────────
  adjustStockForProduct:       'स्टॉक समायोजित करें',
  stockMovementsHeading:       'स्टॉक मूवमेंट',
  movementDate:                'दिनांक',
  movementType:                'प्रकार',
  movementQty:                 'मात्रा',
  movementBalance:             'शेष',
  movementReason:              'कारण',
  movementRef:                 'संदर्भ',

  // ── Sale 409 INSUFFICIENT_STOCK banner ────────────────────────────────────
  errStockShortageTitle:       'अपर्याप्त स्टॉक',
  errStockShortageDetail:      '{product}: केवल {available} {unit} उपलब्ध, {requested} अनुरोधित',
  errStockShortageHint:        'मात्रा कम करें या सहेजने से पहले स्टॉक समायोजित करें।',
  errStockShortageSingular:    '1 आइटम में अपर्याप्त स्टॉक है',
  errStockShortagePlural:      '{count} आइटम में अपर्याप्त स्टॉक है',

  // ── Nav / more menu ───────────────────────────────────────────────────────
  navStockAlerts:              'स्टॉक अलर्ट',
  navPurchases:                'खरीद',

  // ── Dashboard tile ────────────────────────────────────────────────────────
  dashboardLowStockAlert:      'उत्पाद कम स्टॉक में',
  dashboardLowStockSingular:   'उत्पाद कम स्टॉक में',
}
