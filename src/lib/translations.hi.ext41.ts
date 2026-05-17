// ─── HisaabPro — हिंदी Ext 41 (Epic D #125 — लॉयल्टी) ────────────────────
// PR4 — Loyalty frontend (Hindi). Keys mirror translations.en.ext41.ts 1:1.

export const hiExt41 = {
  // ── Settings hub row ─────────────────────────────────────────────────────
  loyaltySettingsTitle: 'लॉयल्टी प्रोग्राम',
  loyaltySettingsDesc: 'पुराने ग्राहकों को रिडीम करने योग्य पॉइंट्स से इनाम दें',

  // ── Program page ─────────────────────────────────────────────────────────
  loyaltyProgramHeader: 'लॉयल्टी प्रोग्राम',
  loyaltyProgramDescription:
    'ग्राहक हर सेल पर पॉइंट्स कमाते हैं और भविष्य की खरीद पर रिडीम कर सकते हैं।',
  loyaltyEnableLabel: 'लॉयल्टी चालू करें',
  loyaltyEnableHint: 'बंद होने पर नए पॉइंट्स न मिलेंगे न रिडीम होंगे।',
  loyaltyAccrualSection: 'पॉइंट्स कमाने के नियम',
  loyaltyRedemptionSection: 'रिडेम्पशन नियम',
  loyaltyExpirySection: 'समाप्ति',

  loyaltyAccrualRateLabel: 'दर (%)',
  loyaltyAccrualRateHint:
    'उदाहरण: 1% → ₹100 खर्च पर 1 पॉइंट। अधिकतम 100%।',
  loyaltyMinSpendLabel: 'न्यूनतम बिल (₹)',
  loyaltyMinSpendHint: 'इससे कम की सेल पर कोई पॉइंट्स नहीं मिलेंगे।',
  loyaltyRedemptionUnitLabel: 'इतने पॉइंट्स के गुणकों में रिडीम करें',
  loyaltyRedemptionUnitHint:
    'पॉइंट्स केवल इस इकाई के पूरे गुणकों में खर्च हो सकते हैं।',
  loyaltyRedemptionRateLabel: 'प्रति यूनिट मूल्य (₹)',
  loyaltyRedemptionRateHint:
    'हर रिडेम्पशन यूनिट बिल में से इतने रुपये की छूट देती है।',
  loyaltyExpiryToggleLabel: 'पॉइंट्स समाप्त होते हैं',
  loyaltyExpiryMonthsLabel: 'इतने महीनों बाद समाप्त',
  loyaltyExpiryNeverHint:
    'बंद होने पर कमाए गए पॉइंट्स हमेशा रहते हैं। डिफ़ॉल्ट: 12-24 महीने।',

  loyaltySaveButton: 'प्रोग्राम सेव करें',
  loyaltySaveProgress: 'सेव हो रहा है…',
  loyaltySavedToast: 'लॉयल्टी प्रोग्राम सेव हो गया',
  loyaltyQueuedToast: 'सेव — ऑनलाइन होने पर सिंक होगा',
  loyaltySaveFailed: 'लॉयल्टी प्रोग्राम सेव नहीं हो सका',
  loyaltyLoadFailed: 'लॉयल्टी प्रोग्राम लोड नहीं हो सका',

  loyaltyErrorRateNegative: 'दर ऋणात्मक नहीं हो सकती',
  loyaltyErrorRateMax: 'दर 100% से अधिक नहीं हो सकती',
  loyaltyErrorMinSpendNegative: 'न्यूनतम बिल ऋणात्मक नहीं हो सकता',
  loyaltyErrorRedemptionUnit: 'रिडेम्पशन यूनिट कम से कम 1 होनी चाहिए',
  loyaltyErrorRedemptionPaise: 'प्रति यूनिट मूल्य ऋणात्मक नहीं हो सकता',
  loyaltyErrorExpiryRange: 'समाप्ति 1 से 60 महीनों के बीच होनी चाहिए',

  // ── Balance chip ─────────────────────────────────────────────────────────
  loyaltyChipPoints: 'पॉइंट्स',
  loyaltyChipNoBalance: 'अभी कोई पॉइंट्स नहीं',
  loyaltyChipExpiringSoon: 'जल्द समाप्त',
  loyaltyChipExpiringWindow: '{days} दिनों में',
  loyaltyChipLoading: 'पॉइंट्स लोड हो रहे हैं…',

  // ── Redemption sheet ────────────────────────────────────────────────────
  loyaltyRedeemTitle: 'लॉयल्टी पॉइंट्स इस्तेमाल करें',
  loyaltyRedeemBalance: 'बैलेंस',
  loyaltyRedeemBillTotal: 'बिल कुल',
  loyaltyRedeemPointsLabel: 'रिडीम करने के पॉइंट्स',
  loyaltyRedeemMax: 'अधिकतम',
  loyaltyRedeemDiscountLabel: 'लागू छूट',
  loyaltyRedeemApply: 'लागू करें',
  loyaltyRedeemRemove: 'रिडेम्पशन हटाएँ',
  loyaltyRedeemCancel: 'रद्द करें',
  loyaltyRedeemExceedsBalance: 'आपके पास इतने पॉइंट्स नहीं हैं',
  loyaltyRedeemExceedsBill: 'रिडेम्पशन बिल से अधिक नहीं हो सकता',
  loyaltyRedeemUnitHint: '{unit} के गुणकों में रिडीम करें',
  loyaltyRedeemAppliedRow: 'लॉयल्टी रिडेम्पशन',
  loyaltyRedeemUsePoints: 'पॉइंट्स इस्तेमाल करें',
  loyaltyRedeemNoProgram: 'इस व्यवसाय के लिए लॉयल्टी सक्रिय नहीं है',
  loyaltyRedeemRequiresParty: 'पॉइंट्स रिडीम करने के लिए ग्राहक चुनें',

  // ── Ledger list ─────────────────────────────────────────────────────────
  loyaltyLedgerTitle: 'पॉइंट्स इतिहास',
  loyaltyLedgerEmpty: 'अभी कोई पॉइंट्स गतिविधि नहीं',
  loyaltyLedgerEmptyDesc:
    'इस ग्राहक की सेल पर मिले और रिडीम हुए पॉइंट्स यहाँ दिखेंगे।',
  loyaltyLedgerError: 'पॉइंट्स इतिहास लोड नहीं हो सका',
  loyaltyLedgerLoadMore: 'और दिखाएँ',
  loyaltyLedgerExpiresOn: 'समाप्त: {date}',
  loyaltyLedgerNeverExpires: 'कोई समाप्ति नहीं',
  loyaltyLedgerNotePrefix: 'नोट',

  loyaltyTypeAc: 'अर्जित',
  loyaltyTypeRd: 'रिडीम',
  loyaltyTypeEx: 'समाप्त',
  loyaltyTypeAd: 'समायोजित',
  loyaltyTypeVd: 'सेल रद्द',
  loyaltyTypeVr: 'सेल बहाल',

  // ── Party detail tab ────────────────────────────────────────────────────
  loyaltyTabTitle: 'लॉयल्टी',
  loyaltyTabSummaryHeader: 'पॉइंट्स सारांश',
  loyaltyTabCurrent: 'वर्तमान',
  loyaltyTabLifetimeEarned: 'कुल अर्जित',
  loyaltyTabLifetimeRedeemed: 'कुल रिडीम',
  loyaltyTabExpiringSoon: 'जल्द समाप्त',
  loyaltyTabDisabled: 'लॉयल्टी चालू नहीं है',
  loyaltyTabDisabledDesc:
    'पॉइंट्स देने के लिए सेटिंग्स में लॉयल्टी प्रोग्राम चालू करें।',
  loyaltyTabGoToSettings: 'लॉयल्टी सेटिंग्स खोलें',
} as const
