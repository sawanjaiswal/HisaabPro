import { useState, useMemo } from 'react';
import type { BusinessSummary } from '../types';
import { businessAPI } from '../services/api';
import { storage } from '../utils/storage';
import { clearOfflineData } from '../hooks/useDataHydration';

export interface BusinessState {
  businesses: BusinessSummary[];
  currentBusinessId: string | null;
  currentBusiness: BusinessSummary | null;
  refreshBusinesses: () => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
  clearBusinessState: () => void;
}

export function useBusinessState(): BusinessState {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>(() => {
    try {
      const cached = storage.getBusinesses();
      return cached ? (JSON.parse(cached) as BusinessSummary[]) : [];
    } catch { return []; }
  });

  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(
    () => storage.getBusinessId()
  );

  const refreshBusinesses = async (): Promise<void> => {
    try {
      const list = await businessAPI.list();
      setBusinesses(list);
      storage.setBusinesses(JSON.stringify(list));
      // Set first business as active if none stored
      if (!storage.getBusinessId() && list.length > 0) {
        storage.setBusinessId(list[0].id);
        setCurrentBusinessId(list[0].id);
      }
    } catch {
      // Keep cached value on network error
    }
  };

  const switchBusiness = async (businessId: string): Promise<void> => {
    const result = await businessAPI.switch(businessId);
    // Server returns new tokens for the target business context
    storage.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    storage.setBusinessId(businessId);
    setCurrentBusinessId(businessId);
    // Clear IndexedDB data for previous business (data isolation)
    clearOfflineData();
    // Reload businesses list
    await refreshBusinesses();
  };

  const clearBusinessState = (): void => {
    storage.removeBusinessId();
    storage.removeBusinesses();
    setBusinesses([]);
    setCurrentBusinessId(null);
  };

  const currentBusiness = useMemo(
    () => businesses.find(b => b.id === currentBusinessId) ?? null,
    [businesses, currentBusinessId]
  );

  return {
    businesses,
    currentBusinessId,
    currentBusiness,
    refreshBusinesses,
    switchBusiness,
    clearBusinessState,
  };
}
