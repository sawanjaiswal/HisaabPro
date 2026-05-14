/**
 * PublicLayoutRoute — React Router layout route that wraps all /p/* children
 * in PublicShell.
 *
 * Usage in App.tsx:
 *   <Route element={<PublicLayoutRoute />}>
 *     <Route path="/p/health" element={<PublicHealthPage />} />
 *     ... PR2-5 routes added here ...
 *   </Route>
 */

import { PublicShell } from '@/components/layout/PublicShell'

export function PublicLayoutRoute() {
  return <PublicShell />
}
