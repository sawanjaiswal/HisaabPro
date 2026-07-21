import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Variants map to the existing `badge-*` classes in components-ui.css — visual
// identity unchanged; cva makes the variant contract the single source of truth.
export const badgeVariants = cva('badge', {
  variants: {
    variant: {
      paid: 'badge-paid',
      pending: 'badge-pending',
      overdue: 'badge-overdue',
      draft: 'badge-draft',
      info: 'badge-info',
    },
  },
  defaultVariants: { variant: 'info' },
})

/** The variant names, without cva's `null | undefined` — for callers that store
 * a variant in their own props/constants and must pick a concrete one. */
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: string
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} role="status">
      {children}
    </span>
  )
}
