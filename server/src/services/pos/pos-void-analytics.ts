/**
 * POS void/restore — post-commit analytics emitter.
 *
 * Extracted from pos-void.service.ts to keep that file under the 250L cap.
 * Both void and restore phases share the same emit pattern: loyalty +
 * commission counter-rows, deferred via queueMicrotask (§3.8 side-effect rule).
 */

import { analyticsEmit } from '../../lib/analytics.js'

type Phase = 'void' | 'restore'

interface LoyaltySym {
  vdRowsWritten?: number
  vrRowsWritten?: number
}

interface CommissionSym {
  reversalRowsWritten: number
}

/**
 * Emit loyalty + commission symmetry counts for a phase. Both fields default
 * to 0; we only emit when the corresponding row count is > 0 so a no-op
 * symmetry call does not flood analytics with zero-rows pings.
 */
export function emitPosVoidAnalytics(args: {
  phase: Phase
  businessId: string
  posSaleId: string
  loyaltySym: LoyaltySym
  commissionSym: CommissionSym
}): void {
  const { phase, businessId, posSaleId, loyaltySym, commissionSym } = args
  queueMicrotask(() => {
    const loyaltyRows = phase === 'void' ? loyaltySym.vdRowsWritten : loyaltySym.vrRowsWritten
    if ((loyaltyRows ?? 0) > 0) {
      analyticsEmit('loyalty_restored', {
        businessId,
        posSaleId,
        phase,
        ...(phase === 'void'
          ? { vdRowsWritten: loyaltySym.vdRowsWritten }
          : { vrRowsWritten: loyaltySym.vrRowsWritten }),
      })
    }
    if (commissionSym.reversalRowsWritten > 0) {
      analyticsEmit('commission_restored', {
        businessId,
        posSaleId,
        phase,
        reversalRowsWritten: commissionSym.reversalRowsWritten,
      })
    }
  })
}
