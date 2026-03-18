import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { businessAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { ROUTES } from '../../config/routes';
import { TIMINGS } from '../../config/timings';
import { formatJoinCode, isValidJoinCode } from './join-business.utils';
import { JOIN_REDIRECT_DELAY_MS } from './join-business.constants';
import type { JoinBusinessStatus } from './join-business.types';

export function useJoinBusiness() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<JoinBusinessStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joinedName, setJoinedName] = useState<string | null>(null);

  // Double-submit guard
  const submittingRef = useRef(false);

  const { refreshBusinesses } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleCodeChange = (value: string) => {
    setCode(formatJoinCode(value));
    if (status !== 'idle') {
      setStatus('idle');
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submittingRef.current) return;

    if (!isValidJoinCode(code)) {
      setErrorMsg('Enter a valid 6-character invite code');
      setStatus('error');
      return;
    }

    submittingRef.current = true;
    setStatus('loading');
    setErrorMsg(null);

    try {
      const result = await businessAPI.join(code);
      setJoinedName(result.businessName);
      setStatus('success');
      await refreshBusinesses();
      toast.success(`Joined ${result.businessName}!`);
      setTimeout(() => navigate(ROUTES.dashboard), JOIN_REDIRECT_DELAY_MS);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setErrorMsg(apiMsg ?? 'Invalid or expired code. Please try again.');
      setStatus('error');
    } finally {
      submittingRef.current = false;
    }
  };

  const isLoading = status === 'loading';

  return {
    code,
    status,
    errorMsg,
    joinedName,
    isLoading,
    handleCodeChange,
    handleSubmit,
  };
}

// Re-export so consumers don't need to import from timings directly
export { TIMINGS };
