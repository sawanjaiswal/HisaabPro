interface BadgeProps {
  variant: 'paid' | 'pending' | 'overdue' | 'draft' | 'info'
  children: string
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`} role="status">
      {children}
    </span>
  )
}
