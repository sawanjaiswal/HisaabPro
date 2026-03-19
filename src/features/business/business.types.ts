export interface BusinessSwitcherProps {
  onClose: () => void
}

export interface BusinessAvatarProps {
  size?: 'default' | 'list'
}

export interface JoinBusinessSuccess {
  businessName: string
  roleName: string
}
