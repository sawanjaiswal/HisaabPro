/**
 * Dashboard — Staff section (Commission MTD widget).
 *
 * Thin wrapper that mounts <CommissionWidget> inside a labelled dashboard
 * section. CommissionWidget self-gates on the `commission.view` permission
 * and renders null if the user is not staff with the right — meaning this
 * section disappears entirely for owners-without-the-perm only when the
 * widget chooses to hide (e.g. zero state could still show context).
 *
 * Render order on the dashboard: after the AlertStrip (alerts above), in
 * the white drawer section alongside TopDebtors + RecentActivity.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { CommissionWidget } from '@/features/commission/components/CommissionWidget'

export function StaffDashboardSection() {
  const { t } = useLanguage()

  return (
    <section className="dashboard-staff-section" aria-labelledby="dashboard-staff-heading">
      <h2 id="dashboard-staff-heading" className="dashboard-staff-section__heading">
        {t.dashboardStaffSectionHeading}
      </h2>
      <CommissionWidget className="dashboard-staff-section__widget" />
    </section>
  )
}
