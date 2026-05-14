// ─── HisaabPro — Hindi Ext 31 (Epic C PR2 — #129 UPI QR on invoice) ──────────

export const hiExt31 = {
  // UpiPayCard
  upiPayCardTitle:      'UPI से भुगतान करें',
  upiPayCardSubtitle:   'QR स्कैन करें या भुगतान के लिए टैप करें',
  upiPayCardCta:        'UPI ऐप खोलें',
  upiPayCardPaidBadge:  'बीजक पूरी तरह भुगतान हो गया',
  upiPayCardNoUpi:      'भुगतान QR दिखाने के लिए सेटिंग में UPI आईडी जोड़ें',
  upiPayCardAddUpi:     'UPI आईडी जोड़ें',
  upiPayCardAmountLine: '{name} को {amount} का भुगतान करें',
  // Business settings — UPI ID input
  upiVpaSettingsLabel:  'UPI आईडी (VPA)',
  upiVpaSettingsHelp:   'उदाहरण: yourname@bank',
  upiVpaInvalidFormat:  'UPI आईडी प्रारूप: name@bank',
  upiVpaSaved:          'UPI आईडी सहेजी गई',
  upiVpaCleared:        'UPI आईडी हटाई गई',
} as const
