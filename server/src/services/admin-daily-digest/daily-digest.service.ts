import { collectDailyDigestMetrics } from './daily-digest.collector.js';
import { formatDailyDigestCard } from './daily-digest.formatter.js';
import { sendTelegramMessage } from '../admin-alert.service.js';

export function getIstDayBoundariesUtc(targetDateStr: string): { startUtc: Date; endUtc: Date } {
  const parts = targetDateStr.split('-').map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000);
  const endUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - (5 * 60 + 30) * 60 * 1000);
  return { startUtc, endUtc };
}

export function getTodayIstDateString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

export async function runDailyAdminDigest(specificDateStr?: string): Promise<{ success: boolean; dateStr: string; error?: string }> {
  const dateStr = specificDateStr || getTodayIstDateString();
  const { startUtc, endUtc } = getIstDayBoundariesUtc(dateStr);

  try {
    const metrics = await collectDailyDigestMetrics(dateStr, startUtc, endUtc);
    const cardText = formatDailyDigestCard(metrics);
    await sendTelegramMessage(cardText);
    return { success: true, dateStr };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Failed to send HisaabPro admin daily digest:', { dateStr, error: errorMsg });
    return { success: false, dateStr, error: errorMsg };
  }
}
