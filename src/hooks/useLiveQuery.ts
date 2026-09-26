import { useState, useEffect, useCallback, useRef } from 'react';
import { liveQueryBus, QueryKey } from '../domain/live-query-bus';

export interface UseLiveQueryOptions<T> {
  enabled?: boolean;
  initialData?: T;
  refetchOnFocus?: boolean;
}

export interface UseLiveQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<T | undefined>;
}

export function useLiveQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options: UseLiveQueryOptions<T> = {}
): UseLiveQueryResult<T> {
  const { enabled = true, initialData, refetchOnFocus = true } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(initialData === undefined);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const serializedKey = JSON.stringify(queryKey);

  const executeQuery = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return undefined;
    setIsFetching(true);
    try {
      const result = await queryFnRef.current();
      setData(result);
      setError(null);
      return result;
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [enabled]);

  // Initial load and key change trigger
  useEffect(() => {
    executeQuery();
  }, [serializedKey, executeQuery]);

  // Subscribe to LiveQueryBus invalidations
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = liveQueryBus.subscribe(queryKey, () => {
      executeQuery();
    });
    return unsubscribe;
  }, [serializedKey, enabled, executeQuery]);

  // Refetch on window focus
  useEffect(() => {
    if (!enabled || !refetchOnFocus || typeof window === 'undefined') return;
    const handleFocus = () => {
      executeQuery();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, refetchOnFocus, executeQuery]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch: executeQuery,
  };
}
