/**
 * Reminder Templates registry — server SSOT.
 *
 * MB-3: render() does ONLY token substitution on the template body.
 * customMessage MUST be appended by the caller AFTER render() returns.
 * Never pass customMessage through render().
 */

export type TemplateKey = 'POLITE' | 'FIRM' | 'URGENT'

export interface TemplateCtx {
  name: string
  amount: string           // formatted rupees string e.g. "₹1,500"
  business_name: string
  due_date: string         // e.g. "15 Jan 2025"
  oldest_invoice_date: string
}

interface Template {
  key: TemplateKey
  label: string
  suggestedBucket: string  // hint for UI chip pre-selection
  body: string
}

export const REMINDER_TEMPLATES: Record<TemplateKey, Template> = {
  POLITE: {
    key: 'POLITE',
    label: 'Polite',
    suggestedBucket: 'current',
    body:
      'Hi {{name}}, this is a friendly reminder that a payment of {{amount}} is due from your account with {{business_name}}. ' +
      'The invoice was raised on {{oldest_invoice_date}}. ' +
      'Please pay at your earliest convenience. Thank you!',
  },
  FIRM: {
    key: 'FIRM',
    label: 'Firm',
    suggestedBucket: 'bucket_31',
    body:
      'Dear {{name}}, we have not yet received {{amount}} owed to {{business_name}}. ' +
      'The payment was due on {{due_date}}. ' +
      'Please settle this at the earliest to avoid any inconvenience.',
  },
  URGENT: {
    key: 'URGENT',
    label: 'Urgent',
    suggestedBucket: 'bucket_61',
    body:
      'IMPORTANT — {{name}}, an immediate payment of {{amount}} is overdue with {{business_name}} ' +
      '(due {{due_date}}). ' +
      'Please contact us immediately if there is any issue.',
  },
}

/**
 * Render a template with the provided context.
 * All tokens are replaced — missing tokens fall back to empty string (no crash).
 *
 * MB-3 contract: caller appends customMessage AFTER this call, never inside it.
 */
export function renderTemplate(key: TemplateKey, ctx: TemplateCtx): string {
  let body = REMINDER_TEMPLATES[key].body

  const replacements: Record<string, string> = {
    '{{name}}': ctx.name,
    '{{amount}}': ctx.amount,
    '{{business_name}}': ctx.business_name,
    '{{due_date}}': ctx.due_date,
    '{{oldest_invoice_date}}': ctx.oldest_invoice_date,
  }

  for (const [token, value] of Object.entries(replacements)) {
    // Use split+join to replace all occurrences without regex
    body = body.split(token).join(value)
  }

  return body
}
