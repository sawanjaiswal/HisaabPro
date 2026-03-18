import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

export function useBusiness() {
  const { businesses, currentBusiness, switchBusiness, refreshBusinesses } = useAuth();
  const toast = useToast();
  const [switching, setSwitching] = useState<string | null>(null);

  const handleSwitch = useCallback(
    async (businessId: string) => {
      if (switching !== null || currentBusiness?.id === businessId) return;
      setSwitching(businessId);
      try {
        await switchBusiness(businessId);
        toast.success('Business switched');
        window.location.href = '/dashboard'; // hard reload to reinit IndexedDB
      } catch {
        toast.error('Failed to switch business');
      } finally {
        setSwitching(null);
      }
    },
    [switching, currentBusiness, switchBusiness, toast],
  );

  return {
    businesses,
    currentBusiness,
    switching,
    handleSwitch,
    refreshBusinesses,
  };
}
