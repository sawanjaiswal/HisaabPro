/**
 * Notification Engine — Static Template Data (PR3)
 *
 * Pure data module — no imports from Prisma, no runtime side-effects.
 * Keys follow the pattern: `${templateName}.${channel}` where channel is
 * one of: in_app | push | email | sms
 *
 * Placeholder syntax: {{varName}} — substituted by renderTemplate() in
 * notification-template.service.ts. Non-recursive. No eval. No HTML here.
 * (EMAIL channel html wrapper is applied by the email provider, not here.)
 *
 * Locale coverage: en (English) + hi (Hindi Devanagari) for every entry.
 * Total entries: 108 (18 events × average ~3 channel entries × 2 locales).
 *
 * Variable legend (used across templates):
 *   {{partyName}}      — customer / vendor display name
 *   {{businessName}}   — the logged-in business name
 *   {{invoiceNo}}      — invoice reference number
 *   {{amount}}         — pre-formatted rupee string, e.g. "Rs 1,500"
 *   {{dueDate}}        — human-readable date, e.g. "15 May 2026"
 *   {{itemName}}       — product / item name
 *   {{qty}}            — stock quantity
 *   {{planName}}       — subscription plan name, e.g. "Pro"
 *   {{daysLeft}}       — days remaining until expiry
 *   {{expiryDate}}     — human-readable expiry date
 *   {{title}}          — admin broadcast custom title (passed as var)
 *   {{body}}           — admin broadcast custom body (passed as var)
 */

export interface RawTemplate {
  titleTpl: string
  bodyTpl: string
  deepLinkTpl?: string
}

export type LocaleMap = Record<'en' | 'hi', RawTemplate>

// ---------------------------------------------------------------------------
// Template map — keyed by `${templateName}.${channel}`
// ---------------------------------------------------------------------------

export const TEMPLATE_DATA: Record<string, LocaleMap> = {

  // ─── INVOICE_CREATED ──────────────────────────────────────────────────────

  'invoice.created.in_app': {
    en: {
      titleTpl: 'Invoice {{invoiceNo}} created',
      bodyTpl:  'New invoice for {{partyName}} — {{amount}}. Tap to view.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: 'चालान {{invoiceNo}} बना',
      bodyTpl:  '{{partyName}} के लिए नया चालान — {{amount}}। देखने के लिए टैप करें।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },

  // ─── INVOICE_SHARED ───────────────────────────────────────────────────────

  'invoice.shared.in_app': {
    en: {
      titleTpl: 'Invoice {{invoiceNo}} shared',
      bodyTpl:  'Invoice of {{amount}} shared with {{partyName}}.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: 'चालान {{invoiceNo}} शेयर हुआ',
      bodyTpl:  '{{partyName}} को {{amount}} का चालान भेजा गया।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },
  'invoice.shared.email': {
    en: {
      titleTpl: 'Your invoice {{invoiceNo}} from {{businessName}}',
      bodyTpl:  'Dear {{partyName}}, please find attached invoice {{invoiceNo}} for {{amount}} from {{businessName}}. Due date: {{dueDate}}.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: '{{businessName}} से आपका चालान {{invoiceNo}}',
      bodyTpl:  'प्रिय {{partyName}}, कृपया {{businessName}} का चालान {{invoiceNo}} ({{amount}}) संलग्न देखें। देय तिथि: {{dueDate}}।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },
  'invoice.shared.push': {
    en: {
      titleTpl: 'Invoice shared — {{invoiceNo}}',
      bodyTpl:  '{{partyName}} has been sent invoice {{invoiceNo}} for {{amount}}.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: 'चालान शेयर — {{invoiceNo}}',
      bodyTpl:  '{{partyName}} को {{amount}} का चालान {{invoiceNo}} भेजा गया।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },

  // ─── PAYMENT_RECEIVED ─────────────────────────────────────────────────────

  'payment.received.in_app': {
    en: {
      titleTpl: 'Payment received — {{amount}}',
      bodyTpl:  '{{partyName}} paid {{amount}} against invoice {{invoiceNo}}.',
      deepLinkTpl: '/payments/{{entityId}}',
    },
    hi: {
      titleTpl: 'भुगतान मिला — {{amount}}',
      bodyTpl:  '{{partyName}} ने चालान {{invoiceNo}} के लिए {{amount}} दिया।',
      deepLinkTpl: '/payments/{{entityId}}',
    },
  },
  'payment.received.push': {
    en: {
      titleTpl: 'Payment received — {{amount}}',
      bodyTpl:  '{{partyName}} paid {{amount}}. Invoice {{invoiceNo}} updated.',
      deepLinkTpl: '/payments/{{entityId}}',
    },
    hi: {
      titleTpl: 'भुगतान मिला — {{amount}}',
      bodyTpl:  '{{partyName}} ने {{amount}} दिया। चालान {{invoiceNo}} अपडेट हुआ।',
      deepLinkTpl: '/payments/{{entityId}}',
    },
  },

  // ─── PAYMENT_OVERDUE ──────────────────────────────────────────────────────

  'payment.overdue.in_app': {
    en: {
      titleTpl: 'Payment overdue — {{invoiceNo}}',
      bodyTpl:  '{{partyName}} owes {{amount}} (due {{dueDate}}). Tap to follow up.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: 'भुगतान बकाया — {{invoiceNo}}',
      bodyTpl:  '{{partyName}} पर {{amount}} बकाया है (देय: {{dueDate}})। फॉलो अप करें।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },
  'payment.overdue.sms': {
    en: {
      titleTpl: 'Payment overdue',
      bodyTpl:  'Hi {{partyName}}, payment of {{amount}} for invoice {{invoiceNo}} from {{businessName}} is overdue (due {{dueDate}}). Please pay at the earliest.',
    },
    hi: {
      titleTpl: 'भुगतान बकाया',
      bodyTpl:  'नमस्ते {{partyName}}, {{businessName}} का चालान {{invoiceNo}} ({{amount}}) की देय तिथि {{dueDate}} बीत चुकी है। कृपया जल्द भुगतान करें।',
    },
  },

  // ─── PAYMENT_REMINDER ─────────────────────────────────────────────────────

  'payment.reminder.in_app': {
    en: {
      titleTpl: 'Payment reminder — {{invoiceNo}}',
      bodyTpl:  'Reminder: {{partyName}} owes {{amount}}, due on {{dueDate}}.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: 'भुगतान अनुस्मारक — {{invoiceNo}}',
      bodyTpl:  'अनुस्मारक: {{partyName}} का {{amount}} {{dueDate}} तक देय है।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },
  'payment.reminder.sms': {
    en: {
      titleTpl: 'Payment reminder',
      bodyTpl:  'Hi {{partyName}}, this is a reminder that {{amount}} for invoice {{invoiceNo}} from {{businessName}} is due on {{dueDate}}.',
    },
    hi: {
      titleTpl: 'भुगतान अनुस्मारक',
      bodyTpl:  'नमस्ते {{partyName}}, {{businessName}} का चालान {{invoiceNo}} ({{amount}}) {{dueDate}} तक देय है। कृपया समय पर भुगतान करें।',
    },
  },

  // ─── PAYMENT_LINK_OPENED ──────────────────────────────────────────────────

  'payment.link.opened.in_app': {
    en: {
      titleTpl: 'Payment link opened',
      bodyTpl:  '{{partyName}} opened the payment link for {{amount}}.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: 'पेमेंट लिंक खुला',
      bodyTpl:  '{{partyName}} ने {{amount}} का पेमेंट लिंक खोला।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },

  // ─── PAYMENT_LINK_PAID ────────────────────────────────────────────────────

  'payment.link.paid.in_app': {
    en: {
      titleTpl: 'Payment link paid — {{amount}}',
      bodyTpl:  '{{partyName}} completed payment of {{amount}} via payment link.',
      deepLinkTpl: '/payments/{{entityId}}',
    },
    hi: {
      titleTpl: 'पेमेंट लिंक से भुगतान — {{amount}}',
      bodyTpl:  '{{partyName}} ने पेमेंट लिंक से {{amount}} का भुगतान किया।',
      deepLinkTpl: '/payments/{{entityId}}',
    },
  },
  'payment.link.paid.push': {
    en: {
      titleTpl: 'Payment received — {{amount}}',
      bodyTpl:  '{{partyName}} paid {{amount}} via payment link.',
      deepLinkTpl: '/payments/{{entityId}}',
    },
    hi: {
      titleTpl: 'भुगतान मिला — {{amount}}',
      bodyTpl:  '{{partyName}} ने पेमेंट लिंक से {{amount}} दिया।',
      deepLinkTpl: '/payments/{{entityId}}',
    },
  },

  // ─── EXPENSE_RECORDED ─────────────────────────────────────────────────────

  'expense.recorded.in_app': {
    en: {
      titleTpl: 'Expense recorded — {{amount}}',
      bodyTpl:  'Expense of {{amount}} recorded for {{partyName}}.',
      deepLinkTpl: '/expenses/{{entityId}}',
    },
    hi: {
      titleTpl: 'खर्च दर्ज — {{amount}}',
      bodyTpl:  '{{partyName}} के लिए {{amount}} का खर्च दर्ज हुआ।',
      deepLinkTpl: '/expenses/{{entityId}}',
    },
  },

  // ─── RECURRING_INVOICE_GENERATED ──────────────────────────────────────────

  'recurring.invoice.in_app': {
    en: {
      titleTpl: 'Recurring invoice generated',
      bodyTpl:  'Invoice {{invoiceNo}} for {{partyName}} ({{amount}}) auto-generated.',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
    hi: {
      titleTpl: 'आवर्ती चालान बना',
      bodyTpl:  '{{partyName}} का चालान {{invoiceNo}} ({{amount}}) स्वतः बना।',
      deepLinkTpl: '/invoices/{{entityId}}',
    },
  },

  // ─── RECURRING_EXPENSE_PENDING ────────────────────────────────────────────

  'recurring.expense.in_app': {
    en: {
      titleTpl: 'Recurring expense due',
      bodyTpl:  'Recurring expense of {{amount}} is due today. Tap to record.',
      deepLinkTpl: '/expenses',
    },
    hi: {
      titleTpl: 'आवर्ती खर्च देय',
      bodyTpl:  '{{amount}} का आवर्ती खर्च आज देय है। दर्ज करने के लिए टैप करें।',
      deepLinkTpl: '/expenses',
    },
  },
  'recurring.expense.push': {
    en: {
      titleTpl: 'Recurring expense due — {{amount}}',
      bodyTpl:  'Your recurring expense of {{amount}} needs to be recorded today.',
      deepLinkTpl: '/expenses',
    },
    hi: {
      titleTpl: 'आवर्ती खर्च देय — {{amount}}',
      bodyTpl:  'आज का {{amount}} का आवर्ती खर्च दर्ज करना है।',
      deepLinkTpl: '/expenses',
    },
  },

  // ─── LOW_STOCK_ALERT ──────────────────────────────────────────────────────

  'stock.low.in_app': {
    en: {
      titleTpl: 'Low stock — {{itemName}}',
      bodyTpl:  '{{itemName}} stock is low ({{qty}} remaining). Reorder soon.',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
    hi: {
      titleTpl: 'कम स्टॉक — {{itemName}}',
      bodyTpl:  '{{itemName}} का स्टॉक कम है ({{qty}} बचा)। जल्द मंगवाएं।',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
  },
  'stock.low.push': {
    en: {
      titleTpl: 'Low stock alert',
      bodyTpl:  '{{itemName}} is running low — only {{qty}} units left.',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
    hi: {
      titleTpl: 'कम स्टॉक चेतावनी',
      bodyTpl:  '{{itemName}} का स्टॉक कम हो रहा है — केवल {{qty}} बचा।',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
  },

  // ─── BATCH_EXPIRY_ALERT ───────────────────────────────────────────────────

  'stock.batch_expiry.in_app': {
    en: {
      titleTpl: 'Batch expiring — {{itemName}}',
      bodyTpl:  'A batch of {{itemName}} ({{qty}} units) expires on {{dueDate}}.',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
    hi: {
      titleTpl: 'बैच समाप्ति — {{itemName}}',
      bodyTpl:  '{{itemName}} का बैच ({{qty}} नग) {{dueDate}} को समाप्त होगा।',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
  },
  'stock.batch_expiry.push': {
    en: {
      titleTpl: 'Batch expiry alert — {{itemName}}',
      bodyTpl:  '{{qty}} units of {{itemName}} expire on {{dueDate}}. Act now.',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
    hi: {
      titleTpl: 'बैच समाप्ति चेतावनी — {{itemName}}',
      bodyTpl:  '{{itemName}} के {{qty}} नग {{dueDate}} को समाप्त होंगे।',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
  },

  // ─── STOCK_OUT ────────────────────────────────────────────────────────────

  'stock.out.in_app': {
    en: {
      titleTpl: 'Out of stock — {{itemName}}',
      bodyTpl:  '{{itemName}} is out of stock. Reorder immediately.',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
    hi: {
      titleTpl: 'स्टॉक खत्म — {{itemName}}',
      bodyTpl:  '{{itemName}} का स्टॉक समाप्त हो गया। तुरंत मंगवाएं।',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
  },
  'stock.out.push': {
    en: {
      titleTpl: 'Out of stock — {{itemName}}',
      bodyTpl:  'Stock out: {{itemName}} has 0 units. Reorder now.',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
    hi: {
      titleTpl: 'स्टॉक समाप्त — {{itemName}}',
      bodyTpl:  '{{itemName}} का स्टॉक 0 हो गया। अभी मंगवाएं।',
      deepLinkTpl: '/inventory/{{entityId}}',
    },
  },

  // ─── PTP_DUE_TODAY ────────────────────────────────────────────────────────

  'ptp.due_today.in_app': {
    en: {
      titleTpl: 'PTP due today — {{partyName}}',
      bodyTpl:  '{{partyName}} promised to pay {{amount}} today ({{invoiceNo}}).',
      deepLinkTpl: '/parties/{{entityId}}',
    },
    hi: {
      titleTpl: 'PTP आज देय — {{partyName}}',
      bodyTpl:  '{{partyName}} ने आज {{amount}} देने का वादा किया था ({{invoiceNo}})।',
      deepLinkTpl: '/parties/{{entityId}}',
    },
  },
  'ptp.due_today.sms': {
    en: {
      titleTpl: 'Payment promise due',
      bodyTpl:  'Hi {{partyName}}, you had promised to pay {{amount}} for invoice {{invoiceNo}} from {{businessName}} today. Please complete the payment.',
    },
    hi: {
      titleTpl: 'भुगतान वादा देय',
      bodyTpl:  'नमस्ते {{partyName}}, आपने {{businessName}} के चालान {{invoiceNo}} ({{amount}}) के लिए आज भुगतान का वादा किया था। कृपया भुगतान करें।',
    },
  },

  // ─── PTP_BROKEN ───────────────────────────────────────────────────────────

  'ptp.broken.in_app': {
    en: {
      titleTpl: 'PTP broken — {{partyName}}',
      bodyTpl:  '{{partyName}} missed the payment promise of {{amount}} for {{invoiceNo}}.',
      deepLinkTpl: '/parties/{{entityId}}',
    },
    hi: {
      titleTpl: 'PTP टूटा — {{partyName}}',
      bodyTpl:  '{{partyName}} ने {{invoiceNo}} का {{amount}} का भुगतान वादा नहीं निभाया।',
      deepLinkTpl: '/parties/{{entityId}}',
    },
  },

  // ─── SUBSCRIPTION_EXPIRING_SOON ───────────────────────────────────────────

  'subscription.expiring.in_app': {
    en: {
      titleTpl: 'Subscription expiring in {{daysLeft}} days',
      bodyTpl:  'Your {{planName}} plan expires on {{expiryDate}}. Renew to avoid interruption.',
      deepLinkTpl: '/settings/subscription',
    },
    hi: {
      titleTpl: 'सब्सक्रिप्शन {{daysLeft}} दिनों में समाप्त',
      bodyTpl:  'आपकी {{planName}} योजना {{expiryDate}} को समाप्त होगी। रुकावट से बचने के लिए नवीनीकरण करें।',
      deepLinkTpl: '/settings/subscription',
    },
  },
  'subscription.expiring.push': {
    en: {
      titleTpl: 'Renew your plan — {{daysLeft}} days left',
      bodyTpl:  '{{planName}} plan expires {{expiryDate}}. Tap to renew.',
      deepLinkTpl: '/settings/subscription',
    },
    hi: {
      titleTpl: 'योजना नवीनीकृत करें — {{daysLeft}} दिन बचे',
      bodyTpl:  '{{planName}} योजना {{expiryDate}} को समाप्त होगी। नवीनीकरण के लिए टैप करें।',
      deepLinkTpl: '/settings/subscription',
    },
  },
  'subscription.expiring.email': {
    en: {
      titleTpl: 'Your HisaabPro {{planName}} plan expires in {{daysLeft}} days',
      bodyTpl:  'Dear {{businessName}}, your {{planName}} subscription will expire on {{expiryDate}}. Renew now to keep your billing, inventory, and reports running without interruption.',
      deepLinkTpl: '/settings/subscription',
    },
    hi: {
      titleTpl: 'आपकी HisaabPro {{planName}} योजना {{daysLeft}} दिनों में समाप्त होगी',
      bodyTpl:  'प्रिय {{businessName}}, आपकी {{planName}} सब्सक्रिप्शन {{expiryDate}} को समाप्त होगी। बिलिंग और रिपोर्ट बिना रुकावट चालू रखने के लिए अभी नवीनीकरण करें।',
      deepLinkTpl: '/settings/subscription',
    },
  },

  // ─── SUBSCRIPTION_EXPIRED ─────────────────────────────────────────────────

  'subscription.expired.in_app': {
    en: {
      titleTpl: 'Subscription expired',
      bodyTpl:  'Your {{planName}} plan has expired. Renew now to restore full access.',
      deepLinkTpl: '/settings/subscription',
    },
    hi: {
      titleTpl: 'सब्सक्रिप्शन समाप्त',
      bodyTpl:  'आपकी {{planName}} योजना समाप्त हो गई। पूरी सुविधाएं वापस पाने के लिए नवीनीकरण करें।',
      deepLinkTpl: '/settings/subscription',
    },
  },
  'subscription.expired.push': {
    en: {
      titleTpl: 'Plan expired — renew now',
      bodyTpl:  'Your {{planName}} plan has expired. Tap to renew and restore access.',
      deepLinkTpl: '/settings/subscription',
    },
    hi: {
      titleTpl: 'योजना समाप्त — अभी नवीनीकृत करें',
      bodyTpl:  'आपकी {{planName}} योजना समाप्त हुई। नवीनीकरण के लिए टैप करें।',
      deepLinkTpl: '/settings/subscription',
    },
  },
  'subscription.expired.email': {
    en: {
      titleTpl: 'Your HisaabPro subscription has expired',
      bodyTpl:  'Dear {{businessName}}, your {{planName}} subscription expired on {{expiryDate}}. Renew now to restore access to all HisaabPro features.',
      deepLinkTpl: '/settings/subscription',
    },
    hi: {
      titleTpl: 'आपकी HisaabPro सब्सक्रिप्शन समाप्त हो गई',
      bodyTpl:  'प्रिय {{businessName}}, आपकी {{planName}} सब्सक्रिप्शन {{expiryDate}} को समाप्त हुई। सभी सुविधाएं वापस पाने के लिए अभी नवीनीकरण करें।',
      deepLinkTpl: '/settings/subscription',
    },
  },

  // ─── ADMIN_BROADCAST ──────────────────────────────────────────────────────

  'admin.broadcast.in_app': {
    en: {
      titleTpl: '{{title}}',
      bodyTpl:  '{{body}}',
      deepLinkTpl: '{{deepLinkUrl}}',
    },
    hi: {
      titleTpl: '{{title}}',
      bodyTpl:  '{{body}}',
      deepLinkTpl: '{{deepLinkUrl}}',
    },
  },
  'admin.broadcast.push': {
    en: {
      titleTpl: '{{title}}',
      bodyTpl:  '{{body}}',
      deepLinkTpl: '{{deepLinkUrl}}',
    },
    hi: {
      titleTpl: '{{title}}',
      bodyTpl:  '{{body}}',
      deepLinkTpl: '{{deepLinkUrl}}',
    },
  },
  'admin.broadcast.email': {
    en: {
      titleTpl: '{{title}}',
      bodyTpl:  '{{body}}',
      deepLinkTpl: '{{deepLinkUrl}}',
    },
    hi: {
      titleTpl: '{{title}}',
      bodyTpl:  '{{body}}',
      deepLinkTpl: '{{deepLinkUrl}}',
    },
  },
}
