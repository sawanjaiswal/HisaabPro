import { getCachedUser } from '@/lib/auth';

/**
 * Returns the active tenant businessId for local-first IndexedDB operations.
 * Defaults to 'default' when unauthenticated or during initial onboarding.
 */
export function resolveCurrentBusinessId(): string {
  try {
    const user = getCachedUser();
    return user?.businessId || 'default';
  } catch {
    return 'default';
  }
}
