/** Hero Phone Mockup — mobile app preview inside a phone frame */

import { Plus, Send, FileText, IndianRupee, ArrowUpRight, Clock, Bell } from 'lucide-react'

export function HeroPhoneMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative w-[260px] lg:w-[220px] ${className}`}>
      {/* Phone frame */}
      <div
        className="rounded-[2rem] border-[3px] overflow-hidden shadow-2xl"
        style={{
          borderColor: 'var(--lp-phone-border, #374151)',
          background: 'var(--lp-bg-surface)',
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between px-5 pt-2 pb-1"
          style={{ background: 'var(--lp-bg-card)' }}
        >
          <span style={{ fontSize: '0.5rem', color: 'var(--lp-text-muted)' }}>9:41</span>
          <div
            className="w-16 h-4 rounded-full"
            style={{ background: 'var(--lp-phone-border, #374151)' }}
          />
          <div className="flex items-center gap-1">
            <div className="w-3 h-1.5 rounded-sm" style={{ background: 'var(--lp-text-muted)' }} />
            <div className="w-3 h-1.5 rounded-sm" style={{ background: 'var(--lp-text-muted)' }} />
          </div>
        </div>

        {/* App header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'var(--lp-accent)' }}>
              <IndianRupee className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-semibold lp-text" style={{ fontSize: '0.625rem' }}>HisaabPro</span>
          </div>
          <Bell className="w-3.5 h-3.5" style={{ color: 'var(--lp-text-muted)' }} />
        </div>

        {/* Content */}
        <div className="px-3 py-3 space-y-3">
          {/* Greeting */}
          <div>
            <p className="font-semibold lp-text" style={{ fontSize: '0.6875rem' }}>Good morning!</p>
            <p style={{ fontSize: '0.5rem', color: 'var(--lp-text-muted)' }}>Sharma Electronics</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Today's Sales", value: '₹45,200', change: '+12%', up: true },
              { label: 'Outstanding', value: '₹1.2L', change: '4 parties', up: false },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg p-2 border"
                style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
              >
                <p style={{ fontSize: '0.4375rem', color: 'var(--lp-text-muted)' }}>{stat.label}</p>
                <p className="font-bold lp-text leading-tight" style={{ fontSize: '0.75rem' }}>{stat.value}</p>
                <p
                  className="flex items-center gap-0.5"
                  style={{ fontSize: '0.4375rem', color: stat.up ? 'var(--lp-mock-success)' : 'var(--lp-mock-warning)' }}
                >
                  {stat.up ? <ArrowUpRight className="w-2 h-2" /> : <Clock className="w-2 h-2" />}
                  {stat.change}
                </p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { icon: Plus, label: 'Invoice', color: 'var(--lp-accent)' },
              { icon: Send, label: 'WhatsApp', color: 'var(--lp-whatsapp, #25d366)' },
              { icon: FileText, label: 'Report', color: 'var(--lp-text-muted)' },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg border"
                style={{ borderColor: 'var(--lp-border-subtle)', color }}
              >
                <Icon className="w-3 h-3" />
                <span style={{ fontSize: '0.4375rem', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Recent invoices */}
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
          >
            <div className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--lp-border-subtle)' }}>
              <p className="font-semibold lp-text" style={{ fontSize: '0.5625rem' }}>Recent Invoices</p>
            </div>
            {[
              { id: 'INV-1042', party: 'Sharma Elec.', amount: '₹12,450', status: 'Paid', color: 'var(--lp-mock-success)' },
              { id: 'INV-1041', party: 'Gupta Traders', amount: '₹8,200', status: 'Due', color: 'var(--lp-mock-warning)' },
              { id: 'INV-1040', party: 'Patel & Sons', amount: '₹15,600', status: 'Paid', color: 'var(--lp-mock-success)' },
              { id: 'INV-1039', party: 'Verma Stores', amount: '₹6,800', status: 'Overdue', color: 'var(--lp-mock-error, #ef4444)' },
            ].map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-2 py-1.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--lp-border-subtle)' }}
              >
                <div className="min-w-0">
                  <p className="font-medium lp-text truncate" style={{ fontSize: '0.5rem' }}>{inv.party}</p>
                  <p style={{ fontSize: '0.4375rem', color: 'var(--lp-text-muted)' }}>{inv.id}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-semibold lp-text" style={{ fontSize: '0.5rem' }}>{inv.amount}</span>
                  <span
                    className="rounded-full px-1 py-0.5 font-medium"
                    style={{ fontSize: '0.375rem', color: inv.color, background: `color-mix(in srgb, ${inv.color} 15%, transparent)` }}
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom nav */}
        <div
          className="flex items-center justify-around px-2 py-2 border-t"
          style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
        >
          {['Home', 'Invoices', 'Parties', 'More'].map((tab, i) => (
            <div
              key={tab}
              className="flex flex-col items-center gap-0.5"
              style={{ color: i === 0 ? 'var(--lp-accent)' : 'var(--lp-text-muted)' }}
            >
              <div className="w-3 h-3 rounded" style={{ background: i === 0 ? 'var(--lp-accent)' : 'var(--lp-bg-elevated)', opacity: i === 0 ? 0.2 : 1 }} />
              <span style={{ fontSize: '0.375rem', fontWeight: i === 0 ? 600 : 400 }}>{tab}</span>
            </div>
          ))}
        </div>

        {/* Home indicator */}
        <div className="flex justify-center py-1.5" style={{ background: 'var(--lp-bg-card)' }}>
          <div className="w-16 h-1 rounded-full" style={{ background: 'var(--lp-text-muted)', opacity: 0.3 }} />
        </div>
      </div>
    </div>
  )
}
