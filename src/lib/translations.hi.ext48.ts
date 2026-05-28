/** Translations — ext48: smart GST filing assistant / readiness check (#144). */

export const hiExt48 = {
  // Page / nav
  gstReadinessTitle: 'GST फाइलिंग जाँच',
  gstReadinessNavDesc: 'GSTR-1 / 3B के लिए फाइलिंग-पूर्व जाँच',
  gstReadinessPeriod: 'रिटर्न अवधि',
  gstReadinessReturnType: 'रिटर्न प्रकार',
  gstReadinessGstr1: 'GSTR-1',
  gstReadinessGstr3b: 'GSTR-3B',

  // Verdict / summary
  gstReadinessReady: 'फाइल करने के लिए तैयार',
  gstReadinessBlocked: 'फाइल करने से पहले समस्याएँ ठीक करें',
  gstReadinessBlockers: 'अवरोधक',
  gstReadinessWarnings: 'चेतावनियाँ',
  gstReadinessScanned: 'दस्तावेज़ जाँचे गए',
  gstReadinessDocsAffected: 'दस्तावेज़ प्रभावित',

  // States
  gstReadinessErrorTitle: 'फाइलिंग जाँच नहीं चल सकी',
  gstReadinessNoIssues: 'कोई समस्या नहीं मिली',
  gstReadinessNoIssuesDesc: 'इस अवधि का हर दस्तावेज़ फाइल करने के लिए तैयार दिखता है।',

  // Severity labels
  gstSevBlocker: 'अवरोधक',
  gstSevWarning: 'चेतावनी',

  // Checks
  gstChkB2bGstinTitle: 'B2B चालान में GSTIN नहीं है',
  gstChkB2bGstinDesc: 'GSTR-1 में दिखने के लिए B2B चालान में खरीदार का GSTIN होना ज़रूरी है।',
  gstChkBadGstinTitle: 'GSTIN प्रारूप अमान्य',
  gstChkBadGstinDesc: 'खरीदार का GSTIN मानक 15-अंकीय प्रारूप से मेल नहीं खाता।',
  gstChkPosTitle: 'आपूर्ति का स्थान नहीं है',
  gstChkPosDesc: 'आपूर्ति का स्थान CGST/SGST बनाम IGST तय करता है — यह खाली नहीं हो सकता।',
  gstChkHsnTitle: 'HSN / SAC कोड नहीं है',
  gstChkHsnDesc: 'कर-योग्य आइटम के लिए HSN (माल) या SAC (सेवा) कोड चाहिए।',
  gstChkSplitTitle: 'आपूर्ति के लिए गलत कर विभाजन',
  gstChkSplitDesc: 'अंतर-राज्यीय आपूर्ति में IGST; राज्य के भीतर CGST + SGST होना चाहिए।',
  gstChkCompTitle: 'कंपोज़िशन डीलर ने GST लिया',
  gstChkCompDesc: 'कंपोज़िशन योजना वाले व्यवसाय चालान पर GST नहीं ले सकते।',
  gstChkZeroTitle: 'कर-योग्य आइटम पर शून्य कर',
  gstChkZeroDesc: 'एक कर-योग्य पंक्ति पर 0% कर है — पुष्टि करें कि यह वास्तव में छूट-प्राप्त है।',
} as const
