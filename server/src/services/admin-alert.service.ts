/**
 * Admin Alert Service for HisaabPro
 * Unified dispatcher for Telegram alerts, dedup, and rate limiting.
 * Never throws — all errors are safely swallowed/logged.
 */

import https from 'https';

export type AlertLevel = 'critical' | 'warning' | 'info';

// DEDUP — same title within 5 min → batch into 1 alert
interface DedupEntry { count: number; firstSeen: number; timer: ReturnType<typeof setTimeout> }
const dedupMap = new Map<string, DedupEntry>();
const DEDUP_WINDOW_MS = 5 * 60_000;

function shouldDedup(key: string): { deduped: boolean; count: number } {
  const existing = dedupMap.get(key);
  if (existing) {
    existing.count++;
    return { deduped: true, count: existing.count };
  }
  const entry: DedupEntry = {
    count: 1,
    firstSeen: Date.now(),
    timer: setTimeout(() => {
      const final = dedupMap.get(key);
      if (final && final.count > 1) {
        void dispatchAlert('warning', key, `Repeated ${final.count}x in last 5 min`);
      }
      dedupMap.delete(key);
    }, DEDUP_WINDOW_MS),
  };
  entry.timer.unref();
  dedupMap.set(key, entry);
  return { deduped: false, count: 1 };
}

// RATE LIMITER (in-memory, max 20/minute)
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const alertTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  while (alertTimestamps.length > 0 && alertTimestamps[0] < windowStart) alertTimestamps.shift();
  if (alertTimestamps.length >= RATE_LIMIT_MAX) return true;
  alertTimestamps.push(now);
  return false;
}

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  critical: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
};

function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatTelegramMessage(level: AlertLevel, title: string, details: string): string {
  const rawAppName = process.env.APP_NAME || 'HisaabPro';
  const emoji = LEVEL_EMOJI[level];
  const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const lines = [
    `🥛 *[${escapeMd(rawAppName.toUpperCase())}] · ${emoji} ${level.toUpperCase()}*`,
    `📌 *${escapeMd(title)}*`,
    '',
    escapeMd(details),
    '',
    `🕒 ${time} IST`,
  ];
  return lines.join('\n');
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8540690656:AAEBmKiJT6dYoiHjHkT1hVOvhFztzc6EALQ';
  const chatId = process.env.TELEGRAM_CHAT_ID || '6115835268';
  if (!token || !chatId) return false;

  const rawThreadId = process.env.TELEGRAM_THREAD_ID || process.env.TELEGRAM_MESSAGE_THREAD_ID;
  const threadId = rawThreadId && !isNaN(Number(rawThreadId)) ? Number(rawThreadId) : undefined;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'MarkdownV2',
    ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
  };

  const body = JSON.stringify(payload);

  return new Promise<boolean>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          const statusCode = res.statusCode ?? 0;
          if (statusCode >= 200 && statusCode < 300) resolve(true);
          else reject(new Error(`Telegram API responded ${statusCode}: ${responseBody.slice(0, 300)}`));
        });
      }
    );
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

async function dispatchAlert(level: AlertLevel, title: string, details: string): Promise<void> {
  if (isRateLimited()) return;

  try {
    const tgText = formatTelegramMessage(level, title, details);
    const sent = await sendTelegramMessage(tgText);
    if (sent) console.info('[AdminAlert] Telegram alert dispatched successfully:', { level, title });
  } catch (err) {
    console.error('[AdminAlert] Telegram send FAILED:', { level, title, err: err instanceof Error ? err.message : String(err) });
  }
}

export async function sendAdminAlert(level: AlertLevel, title: string, details: string): Promise<void> {
  try {
    if (level !== 'critical') {
      const { deduped } = shouldDedup(title);
      if (deduped) return;
    }
    await dispatchAlert(level, title, details);
  } catch (err) {
    console.error('Unexpected error in sendAdminAlert:', { err, level, title });
  }
}
