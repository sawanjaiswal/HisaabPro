/** Hero Dashboard Mockup — HTML-based HisaabPro dashboard preview (replaces stock CRM image) */

import { TrendingUp, FileText, Users, Package, BarChart3, IndianRupee, ArrowUpRight, Clock } from 'lucide-react'

export function HeroDashboardMockup() {
  return (
    <div
      className="w-full rounded-xl overflow-hidden border shadow-2xl"
      style={{ borderColor: 'var(--lp-card-border)', background: 'var(--lp-bg-surface)' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--lp-accent)' }}>
            <IndianRupee className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold lp-text">HisaabPro</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md text-xs" style={{ background: 'var(--lp-bg-elevated)', color: 'var(--lp-text-muted)' }}>
            <span>Sharma Electronics</span>
          </div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-text-inverted)' }}>
            SE
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div
          className="hidden md:flex flex-col w-48 py-3 border-r shrink-0"
          style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
        >
          {[
            { icon: BarChart3, label: 'Dashboard', active: true },
            { icon: FileText, label: 'Invoices', active: false },
            { icon: Users, label: 'Parties', active: false },
            { icon: Package, label: 'Products', active: false },
            { icon: TrendingUp, label: 'Reports', active: false },
          ].map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-xs"
              style={{
                background: active ? 'var(--lp-bg-elevated)' : 'transparent',
                color: active ? 'var(--lp-text)' : 'var(--lp-text-muted)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 min-h-[280px] sm:min-h-[320px]">
          {/* Greeting */}
          <div className="mb-4">
            <p className="text-sm font-semibold lp-text">Dashboard</p>
            <p className="text-xs lp-text-muted">Today, 20 Mar 2026</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Today's Sales", value: '₹45,200', change: '+12%', up: true },
              { label: 'Invoices', value: '1,247', change: '+8', up: true },
              { label: 'Outstanding', value: '₹1,24,500', change: '4 parties', up: false },
              { label: 'Products', value: '312', change: '3 low stock', up: false },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg p-3 border"
                style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
              >
                <p className="text-[0.625rem] lp-text-muted mb-1">{stat.label}</p>
                <p className="text-base font-bold lp-text leading-tight">{stat.value}</p>
                <p
                  className="text-[0.625rem] mt-1 flex items-center gap-0.5"
                  style={{ color: stat.up ? 'var(--lp-mock-success)' : 'var(--lp-mock-warning)' }}
                >
                  {stat.up && <ArrowUpRight className="w-2.5 h-2.5" />}
                  {!stat.up && <Clock className="w-2.5 h-2.5" />}
                  {stat.change}
                </p>
              </div>
            ))}
          </div>

          {/* Recent invoices table */}
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--lp-border-subtle)' }}>
              <p className="text-xs font-semibold lp-text">Recent Invoices</p>
              <p className="text-[0.625rem] lp-text-muted">View all</p>
            </div>
            {[
              { id: 'INV-1042', party: 'Sharma Electronics', amount: '₹12,450', status: 'Paid', statusColor: 'var(--lp-mock-success)' },
              { id: 'INV-1041', party: 'Gupta Traders', amount: '₹8,200', status: 'Due', statusColor: 'var(--lp-mock-warning)' },
              { id: 'INV-1040', party: 'Patel & Sons', amount: '₹15,600', status: 'Paid', statusColor: 'var(--lp-mock-success)' },
            ].map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-3 py-2 text-xs border-b last:border-b-0"
                style={{ borderColor: 'var(--lp-border-subtle)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium lp-text whitespace-nowrap">{inv.id}</span>
                  <span className="lp-text-muted truncate">{inv.party}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold lp-text">{inv.amount}</span>
                  <span
                    className="text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ color: inv.statusColor, background: `color-mix(in srgb, ${inv.statusColor} 15%, transparent)` }}
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
