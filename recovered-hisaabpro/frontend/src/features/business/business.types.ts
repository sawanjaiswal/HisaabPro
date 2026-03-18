import type { BusinessSummary } from '../../types';

export interface BusinessAvatarProps {
  business: BusinessSummary | null;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export interface BusinessSwitcherDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}
