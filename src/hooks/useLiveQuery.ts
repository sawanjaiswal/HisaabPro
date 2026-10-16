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

export const liveQueryMemoryCache = new Map<string, any>();

export function useLiveQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options: UseLiveQueryOptions<T> = {}
): UseLiveQueryResult<T> {
  const { enabled = true, initialData, refetchOnFocus = true } = options;
  const serializedKey = JSON.stringify(queryKey);

  const initialVal = initialData !== undefined ? initialData : liveQueryMemoryCache.get(serializedKey);
  const [data, setData] = useState<T | undefined>(initialVal);
  const dataRef = useRef<T | undefined>(data);
  dataRef.current = data;

  const [isLoading, setIsLoading] = useState<boolean>(initialVal === undefined);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const sequenceRef = useRef(0);
  const lastFocusExecutionTimeRef = useRef(Date.now());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const executeQuery = useCallback(async (isFocusTrigger = false): Promise<T | undefined> => {
    if (!enabled) return undefined;

    const now = Date.now();
    // Throttle window focus re-validations to a 5000ms minimum cooldown
    if (isFocusTrigger) {
      if (now - lastFocusExecutionTimeRef.current < 5000) {
        return dataRef.current;
      }
      lastFocusExecutionTimeRef.current = now;
    }

    const currentSeq = ++sequenceRef.current;
    setIsFetching(true);
    try {
      const result = await queryFnRef.current();
      // Level 6 Sequence & Mount Guard: Discard result if newer query was initiated or component unmounted
      if (isMountedRef.current && currentSeq === sequenceRef.current) {
        liveQueryMemoryCache.set(serializedKey, result);
        setData(result);
        setError(null);
      }
      return result;
    } catch (err: any) {
      if (isMountedRef.current && currentSeq === sequenceRef.current) {
        liveQueryMemoryCache.delete(serializedKey);
        setData(undefined);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      return undefined;
    } finally {
      if (isMountedRef.current && currentSeq === sequenceRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
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

  // Refetch on window focus with 5s cooldown
  useEffect(() => {
    if (!enabled || !refetchOnFocus || typeof window === 'undefined') return;
    const handleFocus = () => {
      executeQuery(true);
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

export function clearLiveQueryMemoryCache(): void {
  liveQueryMemoryCache.clear();
}
