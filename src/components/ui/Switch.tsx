/** Switch — Radix Switch re-skinned as the standard toggle.
 *
 *   <Switch checked={on} onCheckedChange={setOn} ariaLabel="Enable reminders" />
 *
 * Spring-eased thumb (overlay.css), reduced-motion safe. Pair with a
 * <label> or pass ariaLabel for an accessible name.
 */
import { Switch as RX } from 'radix-ui'
import { cn } from '@/lib/utils'
import './overlay.css'

interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
  id?: string
  className?: string
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  ariaLabel,
  id,
  className,
}: SwitchProps) {
  return (
    <RX.Root
      id={id}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn('rx-switch', className)}
    >
      <RX.Thumb className="rx-switch-thumb" />
    </RX.Root>
  )
}
