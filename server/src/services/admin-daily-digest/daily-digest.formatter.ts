import type { HisaabProDailyDigestMetrics } from './daily-digest.types.js';

function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatDailyDigestCard(metrics: HisaabProDailyDigestMetrics): string {
  const lines: string[] = [
    `🥛 *[HISAABPRO] · EXECUTIVE DAILY BRIEFING*`,
    `📅 *${escapeMd(metrics.targetDateStr)}* \\(23:59 IST\\)`,
    ``,
    `💰 *1\\. Invoicing & Sales*`,
    `• Invoices Raised Today: *${metrics.salesAndInvoices.invoicesCreatedToday}*`,
    `• Invoiced Sales: *${escapeMd(formatPaise(metrics.salesAndInvoices.totalSalesPaise))}*`,
    ``,
    `💳 *2\\. Collections & Cash Flow*`,
    `• Payments Received: *${metrics.collections.paymentsReceivedCount}*`,
    `• Total Inward Collected: *${escapeMd(formatPaise(metrics.collections.totalCollectionsPaise))}*`,
    ``,
    `🏢 *3\\. Businesses & User Growth*`,
    `• New Users Today: *${metrics.registrations.newUsers}* \\(Total: ${metrics.registrations.totalUsers}\\)`,
    `• New Businesses Today: *${metrics.registrations.newBusinesses}* \\(Total: ${metrics.registrations.totalBusinesses}\\)`,
    ``,
    `⭐ *4\\. Subscriptions*`,
    `• Active Subscriptions: *${metrics.subscriptions.activeSubscriptions}*`,
    `• Pro Tier: *${metrics.subscriptions.proPlanCount}* · Enterprise Tier: *${metrics.subscriptions.enterprisePlanCount}*`,
    ``,
    `🕒 _Dispatched automatically by HisaabPro Alert Engine_`,
  ];

  return lines.join('\n');
}
