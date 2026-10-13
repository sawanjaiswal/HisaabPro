import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { DateField } from '@/components/ui/DateField'

export const ShowcaseFormsSection: React.FC = () => {
  const [text, setText] = useState('Acme Enterprises')
  const [searchQuery, setSearchQuery] = useState('')
  const [rate, setRate] = useState('4500.00')
  const [category, setCategory] = useState('electronics')
  const [paymentMethod, setPaymentMethod] = useState('upi')
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
          Zero-patch inputs, Search SSOT, currency controls, Select, Checkbox, RadioGroup, Switch, Textarea, and DateField.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: Search & Text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none">
              Search Field (SSOT)
            </span>
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, invoice, or phone..."
              onClear={() => setSearchQuery('')}
            />
          </div>

          <Input
            label="Party Name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            clearable
            onClear={() => setText('')}
            hint="Clearable input"
          />
        </div>

        {/* Row 2: Currency & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Unit Rate (₹)"
            prefixText="₹"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            hint="Padded left to guarantee zero collision"
          />
          <Select
            label="Category"
            value={category}
            onValueChange={setCategory}
            options={selectOptions}
          />
        </div>

        {/* Row 3: DateField & Textarea */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateField
            label="Invoice Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Textarea
            label="Invoice Terms & Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Row 4: Checkboxes, RadioGroup & Switches */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Checkbox */}
          <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-subtle)] space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
              Checkbox Primitive (Crisp Border)
            </span>
            <div className="space-y-2.5">
              <Checkbox
                id="terms-check"
                checked={termsAccepted}
                onCheckedChange={(c) => setTermsAccepted(Boolean(c))}
                label="E-Way Bill"
                description="Required for supplies > ₹50k"
              />
              <Checkbox
                id="sample-unchecked"
                checked={false}
                label="Unchecked Box (High Contrast)"
              />
            </div>
          </div>

          {/* Radio Group */}
          <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-subtle)] space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
              Radio Group (Horizontal SSOT)
            </span>
            <RadioGroup
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              orientation="horizontal"
              className="gap-4 pt-1"
            >
              <RadioGroupItem value="upi" label="UPI" />
              <RadioGroupItem value="bank" label="Bank" />
              <RadioGroupItem value="cash" label="Cash" />
            </RadioGroup>
          </div>

          {/* Switch */}
          <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-subtle)] space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
              Switch (Compact SSOT)
            </span>
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">WhatsApp Notification</div>
                <div className="text-[11px] text-[var(--text-secondary)]">Instant receipt with link</div>
              </div>
              <Switch
                checked={autoSms}
                onCheckedChange={setAutoSms}
                ariaLabel="Toggle WhatsApp Notification"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
