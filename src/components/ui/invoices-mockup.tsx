/** Invoices List Mockup — shows invoice management view for features section */

import { FileText, Users, Package, BarChart3, IndianRupee, Search, Filter, Plus, Download, ChevronDown } from 'lucide-react'

const INVOICES = [
  { id: 'INV-1042', party: 'Sharma Electronics', date: '20 Mar', amount: '₹12,450', status: 'Paid', statusColor: 'var(--lp-mock-success)' },
  { id: 'INV-1041', party: 'Gupta Traders', date: '19 Mar', amount: '₹8,200', status: 'Due', statusColor: 'var(--lp-mock-warning)' },
  { id: 'INV-1040', party: 'Patel & Sons', date: '18 Mar', amount: '₹15,600', status: 'Paid', statusColor: 'var(--lp-mock-success)' },
  { id: 'INV-1039', party: 'Verma Stores', date: '17 Mar', amount: '₹6,800', status: 'Overdue', statusColor: 'var(--lp-mock-error, #ef4444)' },
  { id: 'INV-1038', party: 'Singh Enterprises', date: '16 Mar', amount: '₹22,100', status: 'Paid', statusColor: 'var(--lp-mock-success)' },
]

const TABS = [
  { label: 'All', count: 1247, active: true },
  { label: 'Paid', count: 986, active: false },
  { label: 'Due', count: 198, active: false },
  { label: 'Overdue', count: 63, active: false },
]

export function InvoicesMockup() {
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
            { icon: BarChart3, label: 'Dashboard', active: false },
            { icon: FileText, label: 'Invoices', active: true },
            { icon: Users, label: 'Parties', active: false },
            { icon: Package, label: 'Products', active: false },
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
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold lp-text">Invoices</p>
              <p className="text-[0.625rem] lp-text-muted">Manage your sales invoices</p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[0.625rem] font-medium border"
                style={{ borderColor: 'var(--lp-border-subtle)', color: 'var(--lp-text-muted)' }}
              >
                <Download className="w-3 h-3" />
                Export
              </div>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[0.625rem] font-semibold text-white"
                style={{ background: 'var(--lp-accent)' }}
              >
                <Plus className="w-3 h-3" />
                New Invoice
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-3 border-b" style={{ borderColor: 'var(--lp-border-subtle)' }}>
            {TABS.map((tab) => (
              <div
                key={tab.label}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[0.625rem] font-medium border-b-2 -mb-px"
                style={{
                  borderColor: tab.active ? 'var(--lp-accent)' : 'transparent',
                  color: tab.active ? 'var(--lp-text)' : 'var(--lp-text-muted)',
                }}
              >
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[0.5rem]"
                  style={{
                    background: tab.active ? 'color-mix(in srgb, var(--lp-accent) 15%, transparent)' : 'var(--lp-bg-elevated)',
                    color: tab.active ? 'var(--lp-accent)' : 'var(--lp-text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </div>
            ))}
          </div>

          {/* Search + Filter bar */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[0.625rem]"
              style={{ borderColor: 'var(--lp-border-subtle)', color: 'var(--lp-text-muted)' }}
            >
              <Search className="w-3 h-3 shrink-0" />
              <span>Search invoices...</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[0.625rem]"
              style={{ borderColor: 'var(--lp-border-subtle)', color: 'var(--lp-text-muted)' }}
            >
              <Filter className="w-3 h-3" />
              <span className="hidden sm:inline">Filter</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </div>
          </div>

          {/* Invoice list */}
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--lp-border-subtle)', background: 'var(--lp-bg-card)' }}
          >
            {/* Table header */}
            <div
              className="hidden sm:grid grid-cols-[1fr_1.2fr_0.7fr_0.8fr_0.6fr] gap-2 px-3 py-1.5 text-[0.5625rem] font-semibold uppercase tracking-wider border-b"
              style={{ borderColor: 'var(--lp-border-subtle)', color: 'var(--lp-text-muted)', opacity: 0.7 }}
            >
              <span>Invoice</span>
              <span>Party</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>
            {INVOICES.map((inv) => (
              <div
                key={inv.id}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1.2fr_0.7fr_0.8fr_0.6fr] gap-2 items-center px-3 py-2 text-xs border-b last:border-b-0"
                style={{ borderColor: 'var(--lp-border-subtle)' }}
              >
                <span className="font-medium lp-text">{inv.id}</span>
                <span className="hidden sm:block lp-text-muted truncate">{inv.party}</span>
                <span className="hidden sm:block text-[0.625rem] lp-text-muted">{inv.date}</span>
                <span className="font-semibold lp-text sm:text-right">{inv.amount}</span>
                <span className="sm:text-right">
                  <span
                    className="text-[0.5625rem] px-1.5 py-0.5 rounded-full font-medium inline-block"
                    style={{ color: inv.statusColor, background: `color-mix(in srgb, ${inv.statusColor} 15%, transparent)` }}
                  >
                    {inv.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
