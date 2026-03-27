/** Hero Dashboard Mockup — full-height dashboard preview */

import { TrendingUp, FileText, Users, Package, BarChart3, IndianRupee, ArrowUpRight, Clock, Plus, Send, Download, CreditCard, Wallet } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'

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
          <span className="text-sm font-semibold lp-text">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-md text-xs" style={{ background: 'var(--lp-bg-elevated)', color: 'var(--lp-text-muted)' }}>
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
          className="flex flex-col w-48 py-3 border-r shrink-0"
          style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
        >
          {[
            { icon: BarChart3, label: 'Dashboard', active: true },
            { icon: FileText, label: 'Invoices', active: false },
            { icon: Users, label: 'Parties', active: false },
            { icon: Package, label: 'Products', active: false },
            { icon: TrendingUp, label: 'Reports', active: false },
            { icon: CreditCard, label: 'Payments', active: false },
            { icon: Wallet, label: 'Expenses', active: false },
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
        <div className="flex-1 p-4">
          {/* Greeting */}
          <div className="mb-4">
            <p className="text-sm font-semibold lp-text">Dashboard</p>
            <p className="text-xs lp-text-muted">Today, 20 Mar 2026</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3 mb-4">
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

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { icon: Plus, label: 'New Invoice', color: 'var(--lp-accent)' },
              { icon: Send, label: 'WhatsApp', color: 'var(--lp-whatsapp, #25d366)' },
              { icon: Download, label: 'Report', color: 'var(--lp-text-muted)' },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[0.625rem] font-medium"
                style={{ borderColor: 'var(--lp-border-subtle)', color }}
              >
                <Icon className="w-3 h-3" />
                {label}
              </div>
            ))}
          </div>

          {/* Two-column layout: Invoices + Chart */}
          <div className="grid grid-cols-5 gap-4 mb-4">
            {/* Recent invoices — 3 cols */}
            <div
              className="col-span-3 rounded-lg border overflow-hidden"
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
                { id: 'INV-1039', party: 'Verma Stores', amount: '₹6,800', status: 'Overdue', statusColor: 'var(--lp-mock-error, #ef4444)' },
                { id: 'INV-1038', party: 'Singh Enterprises', amount: '₹22,100', status: 'Paid', statusColor: 'var(--lp-mock-success)' },
                { id: 'INV-1037', party: 'Jain Brothers', amount: '₹4,500', status: 'Due', statusColor: 'var(--lp-mock-warning)' },
                { id: 'INV-1036', party: 'Mehta & Co.', amount: '₹31,200', status: 'Paid', statusColor: 'var(--lp-mock-success)' },
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

            {/* Right column: Chart + Outstanding */}
            <div className="col-span-2 flex flex-col gap-4">
              {/* Weekly Sales Chart */}
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--lp-border-subtle)' }}>
                  <p className="text-xs font-semibold lp-text">This Week</p>
                  <div className="flex items-center gap-1" style={{ color: 'var(--lp-mock-success)', fontSize: '0.625rem', fontWeight: 600 }}>
                    <TrendingUp className="w-2.5 h-2.5" /> +18%
                  </div>
                </div>
                <div className="px-3 py-3 flex items-end justify-between gap-2" style={{ height: 100 }}>
                  {[
                    { day: 'Mon', pct: 45 },
                    { day: 'Tue', pct: 65 },
                    { day: 'Wed', pct: 38 },
                    { day: 'Thu', pct: 82 },
                    { day: 'Fri', pct: 58 },
                    { day: 'Sat', pct: 92 },
                    { day: 'Sun', pct: 30 },
                  ].map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${d.pct}%`,
                          backgroundColor: d.day === 'Sat' ? 'var(--lp-accent)' : 'var(--lp-bg-elevated)',
                          minHeight: 4,
                        }}
                      />
                      <span className="mt-1.5" style={{ fontSize: '0.5rem', color: 'var(--lp-text-muted)' }}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Outstanding */}
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--lp-border-subtle)' }}>
                  <p className="text-xs font-semibold lp-text">Outstanding</p>
                  <span style={{ color: 'var(--lp-mock-warning)', fontSize: '0.625rem', fontWeight: 600 }}>₹1,24,500</span>
                </div>
                {[
                  { name: 'Gupta Traders', amount: '₹45,200', days: '32d' },
                  { name: 'Patel & Sons', amount: '₹38,800', days: '18d' },
                  { name: 'Verma Stores', amount: '₹22,100', days: '7d' },
                  { name: 'Singh Enterprises', amount: '₹18,400', days: '45d' },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between px-3 py-2 text-xs border-b last:border-b-0"
                    style={{ borderColor: 'var(--lp-border-subtle)' }}
                  >
                    <div>
                      <p className="font-medium lp-text">{p.name}</p>
                      <p className="lp-text-muted" style={{ fontSize: '0.5625rem' }}>{p.days} overdue</p>
                    </div>
                    <span style={{ color: 'var(--lp-mock-warning)', fontWeight: 600 }}>{p.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment modes bar */}
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--lp-border-subtle)' }}>
              <p className="text-xs font-semibold lp-text">Collections This Month</p>
            </div>
            <div className="px-3 py-3">
              <div className="flex gap-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--lp-mock-bar-bg)' }}>
                <div className="rounded-full" style={{ width: '45%', backgroundColor: 'var(--lp-accent)' }} />
                <div className="rounded-full" style={{ width: '28%', backgroundColor: 'var(--lp-mock-success)' }} />
                <div className="rounded-full" style={{ width: '15%', backgroundColor: '#8b5cf6' }} />
                <div className="rounded-full" style={{ width: '12%', backgroundColor: 'var(--lp-text-muted)' }} />
              </div>
              <div className="flex gap-5 mt-2" style={{ fontSize: '0.5625rem', color: 'var(--lp-text-muted)' }}>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--lp-accent)' }} /> UPI ₹4.2L
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--lp-mock-success)' }} /> Cash ₹2.6L
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#8b5cf6' }} /> Bank ₹1.4L
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--lp-text-muted)' }} /> Cheque ₹1.1L
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
