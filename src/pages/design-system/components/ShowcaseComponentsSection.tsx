import React, { useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export const ShowcaseComponentsSection: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const [amountValue, setAmountValue] = useState('1500')

  return (
    <div className="space-y-6">
      {/* 2. Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>2. Buttons (`Button` Primitive)</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">Accessible, tactile micro-interactions with loading and icon slots.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="accent">Accent Lime</Button>
            <Button variant="destructive" leftIcon={<Trash2 size={14} />}>Delete</Button>
            <Button variant="ghost">Ghost Action</Button>
            <Button variant="primary" loading>Saving...</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Button size="lg" variant="primary">Large (44px)</Button>
            <Button size="md" variant="primary">Medium (40px)</Button>
            <Button size="sm" variant="primary">Small (32px)</Button>
            <Button size="icon" variant="secondary"><Plus size={16} /></Button>
            <Button size="icon-sm" variant="outline"><Search size={14} /></Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>3. Inputs & Currency Controls (`Input` Primitive)</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">Zero-collision currency prefixes, clearable tokens, and built-in error states.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Standard Text Input"
              placeholder="e.g. Acme Enterprises"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              clearable
              onClear={() => setInputValue('')}
              hint="Type to see clear button"
            />
            <Input
              label="Rate (₹) — Currency Prefix"
              prefixText="₹"
              placeholder="0.00"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              hint="Auto-padded left to guarantee zero glyph collision"
            />
            <Input
              label="Search Input"
              leftIcon={<Search size={14} />}
              placeholder="Search products or parties..."
            />
            <Input
              label="Field with Error State"
              defaultValue="Invalid GSTIN"
              error="GSTIN must be 15 characters long"
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. Badges & 4-State Completeness */}
      <Card>
        <CardHeader>
          <CardTitle>4. Badges & 4-State Primitives</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">Status chips with semantic colors and high-craft empty states.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="paid" dot>PAID</Badge>
            <Badge variant="pending" dot>PENDING</Badge>
            <Badge variant="overdue" dot>OVERDUE</Badge>
            <Badge variant="draft">DRAFT</Badge>
            <Badge variant="info">INFO</Badge>
            <Badge variant="emerald">EMERALD BRAND</Badge>
            <Badge variant="neutral">NEUTRAL</Badge>
          </div>

          <div className="pt-2">
            <EmptyState
              title="No Invoices Generated Yet"
              description="Create your first GST compliant invoice in seconds and share via WhatsApp."
              compact
              action={{
                label: 'Create Invoice',
                leftIcon: <Plus size={14} />,
                onClick: () => {},
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Import Data',
                onClick: () => {},
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
