import { getCachedUser, getCachedBusinesses } from '@/lib/auth';

/**
 * Returns the active tenant businessId for local-first IndexedDB operations.
 * Defaults to 'default' when unauthenticated or during initial onboarding.
 */
export function resolveCurrentBusinessId(): string {
  try {
    const user = getCachedUser();
    if (user?.businessId && user.businessId !== 'default') {
      return user.businessId;
    }
    const businesses = getCachedBusinesses();
    if (businesses && businesses.length > 0 && businesses[0]?.id) {
      return businesses[0].id;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('lastActiveBusinessId');
      if (stored && stored !== 'default') return stored;
    }
    return 'default';
  } catch {
    return 'default';
  }
}

/**
 * Level 6 Search Indexer: Generates prefix & word tokens for sub-1ms Dexie multiEntry lookups.
 */
export function generateSearchTokens(inputs: (string | undefined | null)[]): string[] {
  const tokenSet = new Set<string>();
  for (const raw of inputs) {
    if (!raw) continue;
    const cleaned = String(raw).trim().toLowerCase();
    if (!cleaned) continue;

    // Full token (for exact/prefix match)
    tokenSet.add(cleaned);

    // Word tokens (for names like 'Rajesh Kumar')
    const words = cleaned.split(/[\s\-_,.]+/);
    for (const w of words) {
      if (w.length >= 2) {
        tokenSet.add(w);
      }
    }

    // Phone / numeric digit substrings
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length >= 3) {
      tokenSet.add(digitsOnly);
      // Also index last 4-6 digits for phone searches like 9876
      if (digitsOnly.length >= 6) {
        tokenSet.add(digitsOnly.slice(-6));
        tokenSet.add(digitsOnly.slice(-4));
      }
    }
  }
  return Array.from(tokenSet);
}
