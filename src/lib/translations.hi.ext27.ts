// ─── HisaabPro — Hindi Ext 27 (Marketing Comms — Phase 5 Epic A) ─────────────

export const hiExt27 = {
  // ── Nav ──────────────────────────────────────────────────────────────
  navMarketing:                     'मार्केटिंग',
  navMarketingCampaigns:            'अभियान',
  navMarketingTemplates:            'टेम्पलेट',
  navMarketingReminders:            'रिमाइंडर',
  navMarketingOptOuts:              'ऑप्ट-आउट',

  // ── Hub ───────────────────────────────────────────────────────────────
  marketingHubTitle:                'मार्केटिंग',
  marketingHubSubtitle:             'अभियान, टेम्पलेट और रिमाइंडर',

  // ── Campaign list ────────────────────────────────────────────────────
  campaignListTitle:                'अभियान',
  campaignListEmpty:                'अभी कोई अभियान नहीं',
  campaignListEmptyBody:            'ग्राहकों तक पहुंचने के लिए अपना पहला अभियान बनाएं',
  campaignListEmptyCta:             'पहला अभियान बनाएं',
  campaignListError:                'अभियान लोड नहीं हो सके। दोबारा प्रयास करें।',
  campaignNewBtn:                   'नया अभियान',

  // ── Campaign status labels ────────────────────────────────────────────
  campaignStatusDraft:              'ड्राफ्ट',
  campaignStatusScheduled:          'निर्धारित',
  campaignStatusRunning:            'चल रहा है',
  campaignStatusCompleted:          'पूर्ण',
  campaignStatusFailed:             'विफल',
  campaignStatusCancelled:          'रद्द',

  // ── Campaign detail ──────────────────────────────────────────────────
  campaignDetailSentLabel:          'भेजे गए',
  campaignDetailDeliveredLabel:     'डिलीवर हुए',
  campaignDetailFailedLabel:        'विफल',
  campaignDetailRecipientsLabel:    'प्राप्तकर्ता',
  campaignDetailCostLabel:          'लागत',
  campaignDetailScheduleLabel:      'समय',
  campaignDetailCancelBtn:          'अभियान रद्द करें',
  campaignDetailNoRecipients:       'अभियान में अभी कोई प्राप्तकर्ता नहीं है।',
  campaignDetailError:              'अभियान विवरण लोड नहीं हो सका।',

  // ── Campaign cancel dialog ────────────────────────────────────────────
  campaignCancelTitle:              'यह अभियान रद्द करें?',
  campaignCancelBody:               'पहले से भेजे गए संदेश वापस नहीं लिए जा सकते।',
  campaignCancelConfirm:            'हां, रद्द करें',
  campaignCancelKeep:               'चलता रहे',
  campaignCancelSuccess:            'अभियान रद्द हो गया।',

  // ── Wizard ───────────────────────────────────────────────────────────
  wizardTitle:                      'नया अभियान',
  wizardStep1Label:                 'नाम और चैनल',
  wizardStep2Label:                 'टेम्पलेट',
  wizardStep3Label:                 'दर्शक',
  wizardStep4Label:                 'समय',
  wizardStep5Label:                 'पूर्वावलोकन',
  wizardNextBtn:                    'अगला',
  wizardLaunchBtn:                  'अभियान शुरू करें',
  wizardLaunchingBtn:               'शुरू हो रहा है...',
  wizardLaunchSuccess:              'अभियान शुरू! {count} ग्राहकों को भेजा जा रहा है।',
  wizardOfflineLaunch:              'अभियान शुरू करने के लिए इंटरनेट कनेक्शन आवश्यक है।',

  // ── Template list ────────────────────────────────────────────────────
  templateListTitle:                'टेम्पलेट',
  templateListEmpty:                'अभी कोई टेम्पलेट नहीं',
  templateNewBtn:                   'नया टेम्पलेट',
  templateDeleteTitle:              'यह टेम्पलेट हटाएं?',
  templateDeleteBody:               'इसका उपयोग करने वाले अभियान दोबारा शुरू नहीं हो सकते।',

  // ── Template form ────────────────────────────────────────────────────
  templateFormNewTitle:             'नया टेम्पलेट',
  templateFormEditTitle:            'टेम्पलेट संपादित करें',
  templateFormChannelLabel:         'किस माध्यम से भेजें',
  templateFormNameLabel:            'टेम्पलेट का नाम',
  templateFormBodyLabel:            'संदेश का पाठ',
  templateFormVarsLabel:            'वेरिएबल नाम (कॉमा से अलग)',
  templateFormDltIdLabel:           'DLT टेम्पलेट आईडी',
  templateFormDltRegisteredLabel:   'TRAI के साथ DLT पंजीकरण की पुष्टि',
  templateFormWaNameLabel:          'WhatsApp टेम्पलेट नाम (Meta से)',
  templateFormSaveBtn:              'टेम्पलेट सहेजें',
  templateFormSavingBtn:            'सहेजा जा रहा है...',
  templateFormSuccess:              'टेम्पलेट सहेजा गया।',

  // ── DLT warning ──────────────────────────────────────────────────────
  dltWarningNoId:                   'SMS अभियान शुरू करने से पहले DLT टेम्पलेट आईडी आवश्यक है। नीचे जोड़ें और MSG91 पोर्टल से TRAI में पंजीकृत करें।',
  dltWarningNotRegistered:          'DLT टेम्पलेट आईडी सहेजी गई है लेकिन पंजीकृत नहीं। जब TRAI पंजीकरण पूर्ण हो तो "DLT Registered" सेट करें।',

  // ── Reminder rules ───────────────────────────────────────────────────
  reminderListTitle:                'रिमाइंडर नियम',
  reminderListEmpty:                'कोई रिमाइंडर नियम नहीं',
  reminderListEmptyBody:            'जन्मदिन, भुगतान और अन्य के लिए स्वचालित फॉलो-अप सेट करें',
  reminderListError:                'नियम लोड नहीं हो सके।',
  reminderNewBtn:                   'नया रिमाइंडर नियम',
  reminderFormNewTitle:             'नया रिमाइंडर नियम',
  reminderFormEditTitle:            'नियम संपादित करें',
  reminderFormSaveBtn:              'नियम सहेजें',
  reminderFormSuccess:              'रिमाइंडर नियम सहेजा गया।',
  reminderDeleteTitle:              'यह रिमाइंडर नियम हटाएं?',
  reminderDeleteBody:               'निर्धारित रिमाइंडर रद्द हो जाएंगे।',
  reminderTogglePause:              'नियम रोकें',
  reminderToggleEnable:             'नियम चालू करें',

  // ── Opt-out ──────────────────────────────────────────────────────────
  optOutListTitle:                  'ऑप्ट-आउट',
  optOutListSubtitle:               'संपर्क जो मार्केटिंग संदेश नहीं चाहते',
  optOutListEmpty:                  'कोई ऑप्ट-आउट नहीं',
  optOutListEmptyBody:              'सभी संपर्क मार्केटिंग संदेश प्राप्त करने के योग्य हैं',
  optOutConfirmTitle:               '{name} के लिए मार्केटिंग संदेश की अनुमति दें?',
  optOutConfirmBody:                'यह संपर्क अभियान और रिमाइंडर प्राप्त करना शुरू करेगा।',
  optOutAllowBtn:                   'संदेश की अनुमति दें',
  optOutActionStop:                 'मार्केटिंग संदेश बंद करें',
  optOutActionAllow:                'मार्केटिंग संदेश की अनुमति दें',
  optOutSuccessStop:                '{name} अब मार्केटिंग संदेश नहीं पाएगा।',
  optOutSuccessAllow:               '{name} के लिए मार्केटिंग संदेश फिर से चालू किए गए।',

  // ── Segment errors ───────────────────────────────────────────────────
  segmentEmpty:                     'इन फ़िल्टर से कोई ग्राहक नहीं मिला।',
  segmentTooLarge:                  'दर्शक बहुत बड़ा (अधिकतम 10,000)। और फ़िल्टर जोड़ें।',
  segmentCountLoading:              'प्राप्तकर्ता गिने जा रहे हैं...',

  // ── Error messages ────────────────────────────────────────────────────
  errorNetworkFail:                 'अनुरोध नहीं भेजा जा सका। कनेक्शन जांचें।',
  errorTemplateDltMissing:          'SMS अभियान शुरू करने से पहले DLT टेम्पलेट आईडी जोड़ें।',
  errorTemplateWaNameMissing:       'लॉन्च करने से पहले WhatsApp टेम्पलेट नाम जोड़ें।',
  errorTemplateWaNotApproved:       'लॉन्च से पहले Meta से WhatsApp टेम्पलेट स्वीकृत होना चाहिए।',
  errorCostCapExceeded:             'अनुमानित अभियान लागत आपकी मासिक बजट सीमा से अधिक है।',

  // ── Quiet hours ───────────────────────────────────────────────────────
  quietHoursNotice:                 'शांत समय लागू: TRAI नियमों के अनुसार {end} से {start} के बीच निर्धारित संदेश {end} IST के बाद भेजे जाएंगे।',
}
