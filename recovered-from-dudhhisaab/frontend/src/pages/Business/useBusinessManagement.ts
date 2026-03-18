import { useState, useCallback } from 'react';
import { businessAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { storage } from '../../utils/storage';
import type { BusinessManagementStatus } from './business-management.types';

export function useBusinessManagement() {
  const {
    businesses,
    currentBusinessId,
    switchBusiness,
    refreshBusinesses,
  } = useAuth();

  const toast = useToast();
  const [status, setStatus] = useState<BusinessManagementStatus>('success');
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [regenningId, setRegenningId] = useState<string | null>(null);

  const handleSwitch = useCallback(async (businessId: string) => {
    if (businessId === currentBusinessId) return;
    setSwitchingId(businessId);
    try {
      await switchBusiness(businessId);
      toast.success('Switched business');
    } catch {
      toast.error('Failed to switch business. Please try again.');
    } finally {
      setSwitchingId(null);
    }
  }, [currentBusinessId, switchBusiness, toast]);

  const handleCreateSuccess = useCallback(async (tokens: { accessToken: string; refreshToken: string }) => {
    storage.setTokens(tokens.accessToken, tokens.refreshToken);
    setShowCreateForm(false);
    setStatus('loading');
    try {
      await refreshBusinesses();
    } finally {
      setStatus('success');
    }
  }, [refreshBusinesses]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success('Invite code copied!');
    }).catch(() => {
      toast.error('Could not copy code');
    });
  }, [toast]);

  const handleRegenCode = useCallback(async (businessId: string) => {
    setRegenningId(businessId);
    try {
      const result = await businessAPI.regenerateCode(businessId);
      await refreshBusinesses();
      toast.success(`New code: ${result.joinCode}`, {
        onUndo: undefined,
      });
    } catch {
      toast.error('Failed to regenerate code. Please try again.');
    } finally {
      setRegenningId(null);
    }
  }, [refreshBusinesses, toast]);

  const retry = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      await refreshBusinesses();
      setStatus('success');
    } catch {
      setError('Could not load businesses. Check your connection and try again.');
      setStatus('error');
    }
  }, [refreshBusinesses]);

  return {
    businesses,
    status,
    error,
    currentBusinessId,
    showCreateForm,
    switchingId,
    regenningId,
    setShowCreateForm,
    handleSwitch,
    handleCopyCode,
    handleRegenCode,
    handleCreateSuccess,
    retry,
  };
}
