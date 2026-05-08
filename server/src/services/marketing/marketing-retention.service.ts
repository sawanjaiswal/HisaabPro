/**
 * Marketing Retention Service (PR5)
 * Daily cron 03:00 IST — NULL phone on MarketingCampaignRecipient where
 * dispatchedAt < NOW() - 90d (PII purge per SECURITY_AUDIT §1.5).
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

const RETENTION_DAYS = 90

export async function runMarketingRetentionPurge(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000)

  const result = await prisma.marketingCampaignRecipient.updateMany({
    where: {
      dispatchedAt: { lt: cutoff },
      phone: { not: null },
    },
    data: { phone: null },
  })

  logger.info('marketing.retention.purge_done', { purged: result.count, cutoff })
  return { purged: result.count }
}
