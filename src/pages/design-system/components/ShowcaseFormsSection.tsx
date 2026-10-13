import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { DateField } from '@/components/ui/DateField'

export const ShowcaseFormsSection: React.FC = () => {
  const [text, setText] = useState('Acme Enterprises')
  const [rate, setRate] = useState('4500.00')
  const [category, setCategory] = useState('electronics')
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [autoSms, setAutoSms] = useState(true)
  const [notes, setNotes] = useState('Goods once sold will not be taken back without original bill.')
  const [date, setDate] = useState('2026-10-13')

  const selectOptions = [
    { value: 'electronics', label: 'Electronics & Hardware' },
    { value: 'grocery', label: 'FMCG & Groceries' },
    { value: 'apparel', label: 'Apparel & Textiles' },
    { value: 'services', label: 'Consulting & Services' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forms & Inputs: Full Primitive Suite</CardTitle>
        <p className="text-xs text-[var(--text-secondary)]">
          Unified inputs, currency controls with zero glyph collision, Select, Checkbox, Switch, Textarea, and DateField.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: Text & Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Party Name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            clearable
            onClear={() => setText('')}
            hint="Clearable input"
          />
          <Input
            label="Unit Rate (₹)"
            prefixText="₹"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            hint="Padded left to guarantee zero collision"
          />
        </div>

        {/* Row 2: Select & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={category}
            onValueChange={setCategory}
            options={selectOptions}
          />
          <DateField
            label="Invoice Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Row 3: Textarea */}
        <div>
          <Textarea
            label="Invoice Terms & Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Row 4: Checkboxes & Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-subtle)] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
              Checkbox Primitive
            </span>
            <Checkbox
              id="terms-check"
              checked={termsAccepted}
              onCheckedChange={(c) => setTermsAccepted(Boolean(c))}
              label="Generate E-Way Bill automatically"
              description="Required for interstate supplies exceeding ₹50,000 threshold"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-subtle)] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
              Switch Primitive
            </span>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">WhatsApp Payment Notification</div>
                <div className="text-[11px] text-[var(--text-secondary)]">Instant receipt with payment link</div>
              </div>
              <Switch
                checked={autoSms}
                onCheckedChange={setAutoSms}
                ariaLabel="Toggle WhatsApp Payment Notification"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
