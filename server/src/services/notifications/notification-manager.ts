/**
 * Notification Manager — thin facade over the dispatch service (PR11).
 *
 * notify(eventKey, ctx)
 *   - Wraps dispatch.notify in a try/catch.
 *   - NEVER throws to caller — errors are logged + swallowed.
 *   - Single import surface: `import { notificationManager } from './notification-manager.js'`
 */

import type { EventKey } from './notification-events.js'
import type { NotificationContext } from './notification-types.js'
import { notify as dispatchNotify } from './notification-dispatch.service.js'
import logger from '../../lib/logger.js'

export const notificationManager = {
  async notify(eventKey: EventKey, ctx: NotificationContext): Promise<void> {
    try {
      await dispatchNotify(eventKey, ctx)
    } catch (err) {
      logger.warn('notification.manager.notify.failed', {
        eventKey,
        userId: ctx.userId,
        businessId: ctx.businessId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },
}
