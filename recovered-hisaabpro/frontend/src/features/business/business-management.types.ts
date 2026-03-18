import type { BusinessSummary } from '../../types';

export type BusinessManagementStatus = 'loading' | 'success' | 'error';

export interface CreateBusinessInput {
  name: string;
  type: string;
}

export interface BusinessManagementState {
  businesses: BusinessSummary[];
  status: BusinessManagementStatus;
  creating: boolean;
  error: string | null;
}

export interface BusinessCardProps {
  business: BusinessSummary;
  isActive: boolean;
  onSwitch: () => void;
  onCopyCode: (code: string) => void;
  onRegenCode: () => void;
}

export interface CreateBusinessFormProps {
  onClose: () => void;
  onCreated: (tokens: { accessToken: string; refreshToken: string }) => void;
}
