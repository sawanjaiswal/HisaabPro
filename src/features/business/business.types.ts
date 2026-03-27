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

export interface CreateBusinessInput {
  name: string
  businessType: string
  cloneFromBusinessId?: string
}
