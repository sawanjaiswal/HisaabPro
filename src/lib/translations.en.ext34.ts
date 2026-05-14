// ─── HisaabPro — English Ext 34 (Epic C PR5 — #131 Party Invite-Claim) ──────

export const enExt34 = {
  // Auth-side invite trigger
  inviteToPortalButton:      'Invite to portal',
  inviteToPortalDrawerTitle: 'Invite to HisaabPro Portal',
  inviteToPortalUrlLabel:    'Share this link (one-time only)',
  inviteToPortalCopyCta:     'Copy link',
  inviteToPortalWhatsappCta: 'Send via WhatsApp',
  inviteToPortalOneTime:     'This link cannot be retrieved after you close this drawer.',

  // Public page — greeting + meta
  inviteClaimGreeting:  '{partyName}, {businessName} has invited you to HisaabPro',
  invitePhonePreview:   'Your registered number: {phone}',
  inviteExpiresAt:      'Link expires: {date}',

  // Signup branch
  inviteSignupTitle:       'Create your account',
  inviteSignupNameLabel:   'Your name',
  inviteSignupPasswordLabel: 'Password',
  inviteSignupConfirmLabel:  'Confirm password',
  inviteSignupCta:         'Create account & link',

  // OTP branch
  inviteOtpTitle:      'Verify your number',
  inviteOtpSendCta:    'Send OTP',
  inviteOtpSent:       'OTP sent to {phone}',
  inviteOtpCodeLabel:  'Enter 6-digit OTP',
  inviteOtpResend:     'Resend OTP',
  inviteOtpVerifyCta:  'Verify',

  // Claim
  inviteClaimCta:            'Link my account',
  inviteClaimSuccess:        'Account linked successfully!',
  inviteClaimRedirectToLogin:'Sign in to continue',

  // Terminal error states
  inviteAlreadyClaimed: 'This account has already been claimed.',
  inviteExpired:        'This invite link has expired.',
  inviteRevoked:        'This invite link has been revoked.',
  inviteNotFound:       'Invite link not found.',
  inviteLoadFailed:     'Couldn\'t load the invite. Please try again.',
  inviteOtpInvalid:     'Incorrect OTP. Please try again.',
  inviteOtpExpired:     'OTP has expired. Please request a new one.',
} as const
