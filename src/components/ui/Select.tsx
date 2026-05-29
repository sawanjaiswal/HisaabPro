/** Select — Radix Select re-skinned with design tokens.
 *
 * A token-styled replacement for the 53 raw <select> elements. Unlike a
 * native <select> it portals a styled listbox, supports keyboard type-ahead,
 * and keeps the trigger consistent with <Input> (44px, surface, border).
 *
 *   <Select value={v} onValueChange={setV} placeholder="Choose…">
 *     <SelectItem value="a">Option A</SelectItem>
 *     <SelectItem value="b">Option B</SelectItem>
 *   </Select>
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Select as RX } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import './overlay.css'

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Accessible name for the trigger when no visible label wraps it. */
  ariaLabel?: string
  children: ReactNode
  className?: string
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  ariaLabel,
  children,
  className,
}: SelectProps) {
  return (
    <RX.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
      <RX.Trigger className={cn('rx-select-trigger', className)} aria-label={ariaLabel}>
        <RX.Value placeholder={placeholder} />
        <RX.Icon className="rx-select-icon">
          <ChevronDown size={18} aria-hidden="true" />
        </RX.Icon>
      </RX.Trigger>
      <RX.Portal>
        <RX.Content className="rx-surface" position="popper" sideOffset={6}>
          <RX.Viewport>{children}</RX.Viewport>
        </RX.Content>
      </RX.Portal>
    </RX.Root>
  )
}

export function SelectItem({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RX.Item>) {
  return (
    <RX.Item className={cn('rx-item', className)} {...props}>
      <RX.ItemText>{children}</RX.ItemText>
      <RX.ItemIndicator className="rx-item-indicator">
        <Check size={16} aria-hidden="true" />
      </RX.ItemIndicator>
    </RX.Item>
  )
}
