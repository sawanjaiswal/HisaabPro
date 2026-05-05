/**
 * Reminder Templates — client-side mirror of server registry.
 * SSOT lives server-side; this file is for client preview ONLY.
 *
 * MB-3: render() never processes customMessage — caller appends it after.
 */

export type TemplateKey = 'POLITE' | 'FIRM' | 'URGENT'

export interface TemplateCtx {
  name: string
  amount: string
  business_name: string
  due_date: string
  oldest_invoice_date: string
}

export interface Template {
  key: TemplateKey
  label: string
  suggestedBucket: string
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

/** Render template tokens (client-side preview only). */
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
    body = body.split(token).join(value)
  }

  return body
}

export const TEMPLATE_KEYS: TemplateKey[] = ['POLITE', 'FIRM', 'URGENT']
