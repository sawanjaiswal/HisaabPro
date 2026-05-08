// ─── HisaabPro — Hindi Ext 26 (BOM / Production — PR4-PR6) ─────────────────

export const hiExt26 = {
  // ── Nav ──────────────────────────────────────────────────────────────
  navProduction:              'उत्पादन',
  navRecipes:                 'व्यंजन/नुस्खा',
  navProductionRuns:          'उत्पादन रन',

  // ── BOM list ─────────────────────────────────────────────────────────
  bomListTitle:               'सामग्री सूची',
  bomListEmpty:               'अभी कोई व्यंजन नहीं',
  bomListEmptyBody:           'उत्पादन ट्रैक करने के लिए सामग्री सूची (BOM) बनाएं।',
  bomListError:               'व्यंजन लोड नहीं हो सके',
  bomListNewBtn:              'नया व्यंजन',

  // ── BOM form ─────────────────────────────────────────────────────────
  bomFormNewTitle:            'नया व्यंजन',
  bomFormEditTitle:           'व्यंजन संपादित करें',
  bomFormNameLabel:           'व्यंजन का नाम',
  bomFormProductLabel:        'तैयार उत्पाद',
  bomFormNotesLabel:          'नोट्स',
  bomFormIsDefaultLabel:      'इस उत्पाद के लिए डिफ़ॉल्ट व्यंजन सेट करें',
  bomFormIsActiveLabel:       'व्यंजन सक्रिय है',
  bomFormComponentsTitle:     'घटक',
  bomFormAddComponent:        'घटक जोड़ें',
  bomFormSaveBtn:             'व्यंजन सहेजें',
  bomFormSuccessToast:        'व्यंजन सहेजा गया',
  bomFormVersionedToast:      'नया व्यंजन संस्करण बनाया',
  bomFormDeleteBtn:           'व्यंजन हटाएं',
  bomFormDeleteConfirmTitle:  'व्यंजन हटाएं?',
  bomFormDeleteConfirmBody:   'यह व्यंजन सॉफ्ट-डिलीट हो जाएगा। मौजूदा उत्पादन रन प्रभावित नहीं होंगे।',

  // ── BOM validation ────────────────────────────────────────────────────
  bomValidName:               'व्यंजन का नाम आवश्यक है',
  bomValidProduct:            'तैयार उत्पाद आवश्यक है',
  bomValidComponents:         'कम से कम एक घटक जोड़ें',
  bomValidQty:                'मात्रा 0 से अधिक होनी चाहिए',
  bomValidSelfRef:            'घटक तैयार उत्पाद के समान नहीं हो सकता',
  bomValidDuplicate:          'यह उत्पाद पहले से जोड़ा जा चुका है',

  // ── Production runs ───────────────────────────────────────────────────
  prListTitle:                'उत्पादन रन',
  prListEmpty:                'अभी कोई उत्पादन रन नहीं',
  prListEmptyBody:            'उत्पादन ट्रैक करने के लिए BOM से रन शुरू करें।',
  prListError:                'उत्पादन रन लोड नहीं हो सके',
  prListStartBtn:             'रन शुरू करें',

  // ── Wizard ────────────────────────────────────────────────────────────
  prWizardStep1:              'व्यंजन चुनें',
  prWizardStep2:              'उत्पादित मात्रा और तारीख',
  prWizardStep3:              'घटकों की समीक्षा करें',
  prWizardStep4:              'रन की पुष्टि करें',
  prWizardConfirmBtn:         'उत्पादन रन शुरू करें',
  prWizardStarting:           'रन शुरू हो रहा है...',
  prWizardSuccess:            'उत्पादन रन पूरा हुआ',

  // ── Stock warnings ────────────────────────────────────────────────────
  prStockInsufficient:        'स्टॉक अपर्याप्त है',
  prStockLowBanner:           'कुछ सामग्री का स्टॉक कम है। रन चेतावनी के साथ जारी रहेगा।',
  prStockBlockBanner:         'आगे नहीं बढ़ सकते — एक या अधिक घटकों का स्टॉक अपर्याप्त है।',

  // ── Cancel ────────────────────────────────────────────────────────────
  prCancelBtn:                'रन रद्द करें',
  prCancelTitle:              'उत्पादन रन रद्द करें?',
  prCancelBody:               'यह सभी स्टॉक मूवमेंट को उलट देगा। तैयार माल कम होगा और कच्चा माल वापस आएगा। यह पूर्ववत नहीं किया जा सकता।',
  prCancelKeep:               'रन रखें',
  prCancelSuccess:            'उत्पादन रन रद्द हुआ',
  prBomNotActive:             'यह व्यंजन अब सक्रिय नहीं है',
}
