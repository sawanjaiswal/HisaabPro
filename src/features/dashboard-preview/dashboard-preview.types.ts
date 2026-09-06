export type TimeFilter = 'today' | '7d' | '30d'

export interface QuickDockAction {
  id: string
  label: string
  route: string
  iconName: 'plus' | 'arrow-down-left' | 'scan' | 'user-plus'
  highlight?: boolean
}

export interface ActionableCard {
  id: string
  title: string
  subtitle: string
  badgeText: string
  badgeTone: 'urgent' | 'warning' | 'info'
  ctaLabel: string
  ctaRoute?: string
  actionType?: 'whatsapp' | 'navigate'
  partyPhone?: string
  amount?: number
}
