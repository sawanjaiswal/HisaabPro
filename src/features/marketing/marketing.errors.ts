/** Marketing — error code → user-readable string map */

export const MARKETING_ERROR_MESSAGES: Record<string, string> = {
  TEMPLATE_DLT_MISSING:     'Add DLT Template ID to this template before launching an SMS campaign.',
  TEMPLATE_WA_NAME_MISSING: 'Add WhatsApp template name before launching.',
  TEMPLATE_WA_NOT_APPROVED: 'WhatsApp template must be approved by Meta before launching.',
  SEGMENT_EMPTY:            'No customers match these filters.',
  SEGMENT_TOO_LARGE:        'Audience too large (max 10,000). Add more filters.',
  INVALID_TRANSITION:       'Campaign cannot be launched in its current state.',
  COST_CAP_EXCEEDED:        'Estimated campaign cost exceeds your monthly budget cap.',
  PROVIDER_NOT_CONFIGURED:  'Provider not configured. Campaign will be queued and retried.',
  WEBHOOK_BAD_SIGNATURE:    'Webhook signature verification failed.',
  UNAUTHORIZED:             'You must be signed in to do this.',
  NOT_FOUND:                'Could not find the requested resource.',
}

export function getMarketingErrorMessage(code: string, fallback?: string): string {
  return MARKETING_ERROR_MESSAGES[code] ?? fallback ?? 'An unexpected error occurred. Please try again.'
}
