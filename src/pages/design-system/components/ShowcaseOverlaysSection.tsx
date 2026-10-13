import React, { useState } from 'react'
import { Plus, Trash2, Info, Eye, SlidersHorizontal, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover'
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/Input'

export const ShowcaseOverlaysSection: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* 1. Section Card Shells & Surface Containers */}
        <Card>
          <CardHeader>
            <CardTitle>Section Card Shells (`FormSection` & `Card`)</CardTitle>
            <p className="text-xs text-[var(--text-secondary)]">
              Consistent card frames, labelled continuous-scroll form sections, and headers.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection
              title="Party & Billing Information"
              action={
                <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />}>
                  Add Alternate GSTIN
                </Button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input label="Business Name" defaultValue="Apex Enterprises Pvt Ltd" />
                <Input label="GSTIN" defaultValue="27AABCU9603R1ZM" />
              </div>
            </FormSection>
          </CardContent>
        </Card>

        {/* 2. Modals, Drawers & Popups */}
        <Card>
          <CardHeader>
            <CardTitle>Overlays: Modals, Bottom Drawers & Popups</CardTitle>
            <p className="text-xs text-[var(--text-secondary)]">
              Radix focus-trapped dialogs, mobile bottom sheets (TaskFrame), and portalled popovers.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">
                Modal & Drawer Triggers
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  leftIcon={<SlidersHorizontal size={14} />}
                  onClick={() => setDrawerOpen(true)}
                >
                  Open Bottom Drawer / Sheet
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Eye size={14} />}
                  onClick={() => setModalOpen(true)}
                >
                  Open Centered Modal
                </Button>
                <Button
                  variant="destructive"
                  leftIcon={<Trash2 size={14} />}
                  onClick={() => setDialogOpen(true)}
                >
                  Confirm Dialog
                </Button>

                {/* Radix Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      Interactive Popover
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4 space-y-3">
                    <div className="font-bold text-xs text-[var(--text-primary)]">Quick GST Breakdown</div>
                    <div className="text-xs text-[var(--text-secondary)] space-y-1">
                      <div className="flex justify-between"><span>Taxable:</span><span className="font-mono">₹10,000.00</span></div>
                      <div className="flex justify-between"><span>CGST (9%):</span><span className="font-mono">₹900.00</span></div>
                      <div className="flex justify-between"><span>SGST (9%):</span><span className="font-mono">₹900.00</span></div>
                      <div className="flex justify-between font-bold pt-1 border-t border-[var(--border-default)]"><span>Total:</span><span className="font-mono text-[var(--primary)]">₹11,800.00</span></div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Centered Modal */}
              <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Create Customer Record"
              >
                <div className="space-y-4 pt-2">
                  <Input label="Customer Name" placeholder="e.g. Ramesh Traders" />
                  <Input label="Phone Number" prefixText="+91" placeholder="98765 43210" />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={() => setModalOpen(false)} leftIcon={<Check size={14} />}>Save Customer</Button>
                  </div>
                </div>
              </Modal>

              {/* Bottom Drawer (TaskFrame) */}
              <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title="Filter Invoices & Statements"
                footer={
                  <div className="flex items-center justify-end gap-2 w-full">
                    <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Reset</Button>
                    <Button variant="primary" onClick={() => setDrawerOpen(false)}>Apply Filters</Button>
                  </div>
                }
              >
                <div className="space-y-4 py-3">
                  <Input label="Invoice Number Range" placeholder="INV-001 to INV-100" />
                  <Input label="Minimum Amount (₹)" prefixText="₹" placeholder="1,000.00" />
                  <p className="text-xs text-[var(--text-secondary)]">
                    Bottom sheet automatically responds to touch swipes on mobile and displays as an elegant modal on desktop.
                  </p>
                </div>
              </Drawer>

              {/* Destructive Confirm Dialog */}
              <ConfirmDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onConfirm={() => setDialogOpen(false)}
                title="Delete Customer Account?"
                description="This will permanently delete Acme Corp and all associated unpaid ledgers. This action cannot be undone."
                confirmLabel="Yes, Delete Account"
                cancelLabel="Keep Customer"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Badges & Tooltips */}
        <Card>
          <CardHeader>
            <CardTitle>Badges & Accessible Tooltips</CardTitle>
            <p className="text-xs text-[var(--text-secondary)]">Status indicators with semantic color mappings and hover tooltips.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Status Badges</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="paid" dot>PAID</Badge>
                <Badge variant="pending" dot>PENDING</Badge>
                <Badge variant="overdue" dot>OVERDUE</Badge>
                <Badge variant="draft">DRAFT</Badge>
                <Badge variant="info">INFO</Badge>
                <Badge variant="emerald">BRAND EMERALD</Badge>
                <Badge variant="neutral">NEUTRAL</Badge>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Radix Tooltip</span>
              <div className="flex items-center gap-3">
                <Tooltip content="Calculates GST @ 18% automatically">
                  <Button variant="secondary" size="sm" leftIcon={<Info size={14} />}>
                    Hover For Tooltip
                  </Button>
                </Tooltip>
                <span className="text-xs text-[var(--text-muted)]">Portalled tooltip with smooth delay & arrow</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. 4-State Primitives: Empty State */}
        <Card>
          <CardHeader>
            <CardTitle>4-State Primitives: Actionable Empty State</CardTitle>
            <p className="text-xs text-[var(--text-secondary)]">Never blank screens or unguided dead-ends.</p>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No Invoices Found"
              description="Create your first GST compliant invoice in seconds and share via WhatsApp."
              compact
              action={{
                label: 'Create Invoice',
                leftIcon: <Plus size={14} />,
                onClick: () => {},
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Bulk Import Excel',
                onClick: () => {},
              }}
            />
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
