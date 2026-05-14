// ─── HisaabPro — Hindi Ext 34 (Epic C PR5 — #131 Party Invite-Claim) ────────

export const hiExt34 = {
  // Auth-side invite trigger
  inviteToPortalButton:      'पोर्टल पर आमंत्रित करें',
  inviteToPortalDrawerTitle: 'HisaabPro पोर्टल पर आमंत्रित करें',
  inviteToPortalUrlLabel:    'यह लिंक साझा करें (केवल एक बार)',
  inviteToPortalCopyCta:     'लिंक कॉपी करें',
  inviteToPortalWhatsappCta: 'WhatsApp से भेजें',
  inviteToPortalOneTime:     'यह ड्रॉअर बंद करने के बाद लिंक वापस नहीं मिलेगा।',

  // Public page — greeting + meta
  inviteClaimGreeting:  '{partyName}, {businessName} ने आपको HisaabPro पर आमंत्रित किया है',
  invitePhonePreview:   'आपका पंजीकृत नंबर: {phone}',
  inviteExpiresAt:      'लिंक समाप्त होगा: {date}',

  // Signup branch
  inviteSignupTitle:         'अपना खाता बनाएं',
  inviteSignupNameLabel:     'आपका नाम',
  inviteSignupPasswordLabel: 'पासवर्ड',
  inviteSignupConfirmLabel:  'पासवर्ड की पुष्टि करें',
  inviteSignupCta:           'खाता बनाएं और लिंक करें',

  // OTP branch
  inviteOtpTitle:      'अपना नंबर सत्यापित करें',
  inviteOtpSendCta:    'OTP भेजें',
  inviteOtpSent:       '{phone} पर OTP भेजा गया',
  inviteOtpCodeLabel:  '6-अंकी OTP दर्ज करें',
  inviteOtpResend:     'OTP फिर से भेजें',
  inviteOtpVerifyCta:  'सत्यापित करें',

  // Claim
  inviteClaimCta:             'मेरा खाता लिंक करें',
  inviteClaimSuccess:         'खाता सफलतापूर्वक लिंक हो गया!',
  inviteClaimRedirectToLogin: 'जारी रखने के लिए साइन इन करें',

  // Terminal error states
  inviteAlreadyClaimed: 'यह खाता पहले ही क्लेम किया जा चुका है।',
  inviteExpired:        'यह आमंत्रण लिंक समाप्त हो गया है।',
  inviteRevoked:        'यह आमंत्रण लिंक रद्द कर दिया गया है।',
  inviteNotFound:       'आमंत्रण लिंक नहीं मिला।',
  inviteLoadFailed:     'आमंत्रण लोड नहीं हो सका। कृपया पुनः प्रयास करें।',
  inviteOtpInvalid:     'गलत OTP। कृपया पुनः प्रयास करें।',
  inviteOtpExpired:     'OTP समाप्त हो गया। कृपया नया OTP मांगें।',
} as const
