import React, { useState } from 'react'
import { MoreVertical, Edit2, Copy, Trash2, FileText, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { Button } from '@/components/ui/Button'
import { FilterChips } from '@/components/ui/FilterChips'

export const ShowcaseNavigationSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState('invoices')
  const [activeFilter, setActiveFilter] = useState('all')

  const filterOptions = [
    { value: 'all', label: 'All Transactions' },
    { value: 'paid', label: 'Paid (₹1,24,000)' },
    { value: 'pending', label: 'Pending (₹42,500)' },
    { value: 'overdue', label: 'Overdue (3)' },
  ]

  return (
    <div className="space-y-6">
      {/* 1. Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation: Tabs Primitive (`Tabs`, `TabsList`, `TabsTrigger`)</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">Radix headless tabs with Segmented, Line/Underline, and Pills variants.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Segmented Tabs */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Variant: Segmented</span>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList variant="segmented">
                <TabsTrigger value="invoices" icon={<FileText size={14} />} badge="12">Invoices</TabsTrigger>
                <TabsTrigger value="payments" icon={<CheckCircle2 size={14} />}>Payments</TabsTrigger>
                <TabsTrigger value="customers">Customers</TabsTrigger>
              </TabsList>
              <div className="mt-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-secondary)]">
                Active tab: <strong className="text-[var(--text-primary)]">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong>
              </div>
            </Tabs>
          </div>

          {/* Underline / Line Tabs */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Variant: Line / Underline</span>
            <Tabs defaultValue="overview">
              <TabsList variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics" badge="New">Analytics</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Pills Tabs */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Variant: Pills</span>
            <Tabs defaultValue="week">
              <TabsList variant="pills">
                <TabsTrigger value="day">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
                <TabsTrigger value="year">FY 2026-27</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* 2. Dropdown Menus & Filter Chips */}
      <Card>
        <CardHeader>
          <CardTitle>Dropdown Menus & Filter Chips</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">Radix portalled dropdown actions and quick filtering pills.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Context Dropdown Actions</span>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" rightIcon={<MoreVertical size={14} />}>
                    Invoice Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem className="flex items-center gap-2">
                    <Edit2 size={14} /> Edit Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2">
                    <Copy size={14} /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem danger className="flex items-center gap-2">
                    <Trash2 size={14} /> Delete Invoice
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="text-xs text-[var(--text-muted)]">Click button to open accessible keyboard-friendly menu</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Filter Chips</span>
            <FilterChips
              options={filterOptions}
              value={activeFilter}
              onChange={setActiveFilter}
              label="Transaction filters"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
