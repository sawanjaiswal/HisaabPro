/**
 * Email Template Renderers — inline-styled HTML for transactional emails
 * All templates are mobile-friendly with max-width container.
 */

interface ReminderEmailData {
  businessName: string
  partyName: string
  amount: string
  dueDate: string
  invoiceNumber: string
}

interface InvoiceShareEmailData {
  businessName: string
  partyName: string
  invoiceNumber: string
  amount: string
}

function wrapLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
${body}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:16px 24px;text-align:center;color:#8c8c8c;font-size:12px;">
Sent via <strong>HisaabPro</strong> &mdash; Smart billing for Indian businesses
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function renderReminderEmail(data: ReminderEmailData): string {
  const body = `
<tr><td style="background-color:#1a56db;padding:24px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Payment Reminder</h1>
</td></tr>
<tr><td style="padding:32px 24px;">
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
Dear ${escapeHtml(data.partyName)},
</p>
<p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
This is a friendly reminder from <strong>${escapeHtml(data.businessName)}</strong> regarding your outstanding payment.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;margin-bottom:24px;">
<tr><td style="padding:20px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:4px 0;color:#6b7280;font-size:14px;">Invoice</td>
<td style="padding:4px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(data.invoiceNumber)}</td>
</tr>
<tr>
<td style="padding:4px 0;color:#6b7280;font-size:14px;">Amount Due</td>
<td style="padding:4px 0;color:#dc2626;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(data.amount)}</td>
</tr>
<tr>
<td style="padding:4px 0;color:#6b7280;font-size:14px;">Due Date</td>
<td style="padding:4px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(data.dueDate)}</td>
</tr>
</table>
</td></tr>
</table>
<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
Please make the payment at your earliest convenience. If you have already paid, please disregard this reminder.
</p>
</td></tr>`

  return wrapLayout('Payment Reminder', body)
}

export function renderInvoiceShareEmail(data: InvoiceShareEmailData): string {
  const body = `
<tr><td style="background-color:#1a56db;padding:24px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Invoice from ${escapeHtml(data.businessName)}</h1>
</td></tr>
<tr><td style="padding:32px 24px;">
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
Dear ${escapeHtml(data.partyName)},
</p>
<p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
Please find your invoice details below.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;margin-bottom:24px;">
<tr><td style="padding:20px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:4px 0;color:#6b7280;font-size:14px;">Invoice Number</td>
<td style="padding:4px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(data.invoiceNumber)}</td>
</tr>
<tr>
<td style="padding:4px 0;color:#6b7280;font-size:14px;">Amount</td>
<td style="padding:4px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(data.amount)}</td>
</tr>
</table>
</td></tr>
</table>
<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
If a PDF is attached, please download it for your records. For any queries, contact ${escapeHtml(data.businessName)} directly.
</p>
</td></tr>`

  return wrapLayout(`Invoice ${data.invoiceNumber}`, body)
}

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
