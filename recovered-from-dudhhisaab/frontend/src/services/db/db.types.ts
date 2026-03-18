/**
 * IndexedDB Entity Types for DudhHisaab
 *
 * All shared interfaces for IndexedDB tables.
 * Extracted here to keep db/index.ts under 250 lines.
 */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  sellRate?: number;
  cowRate?: number;
  buffaloRate?: number;
  defaultQuantity?: number;
  outstandingBalance?: number;
  billingCycle?: string;
  billingStartDay?: number;
  customBillingDays?: number | null;
  nextBillingDate?: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryOrder?: number | null;
  isArchived: boolean;
  isLocked?: boolean; // Not indexed (IndexedDB can't index booleans) — used for offline filter scan
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  cowRate?: number;
  buffaloRate?: number;
  outstandingBalance?: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MilkOutEntry {
  id: string;
  customerId: string;
  date: string;
  session: 'MORNING' | 'EVENING';
  quantity: number;
  milkType: 'COW' | 'BUFFALO';
  rate: number;
  amount: number;
  wasSkipped?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MilkInEntry {
  id: string;
  supplierId: string;
  date: string;
  session: 'MORNING' | 'EVENING';
  quantity: number;
  milkType: 'COW' | 'BUFFALO';
  rate: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  entityId: string;
  entityType: 'customer' | 'supplier';
  amount: number;
  direction: 'received' | 'paid';
  mode: 'cash' | 'upi' | 'bank' | 'other';
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalProductEntry {
  id: string;
  customerId: string;
  productId: string;
  date: string;
  quantity: number;
  price: number;
  totalCost: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  queueId?: number; // Auto-increment
  entity: 'customers' | 'suppliers' | 'products' | 'milkOut' | 'milkIn' | 'payments' | 'productEntries';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId?: string; // For UPDATE/DELETE
  payload: Record<string, unknown>;
  priority: number; // 1 = highest, 5 = lowest
  timestamp: number;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  /**
   * Idempotency key for CREATE operations.
   * Generated once on first processing attempt; all retries reuse the same key.
   * Sent as X-Idempotency-Key header so the backend deduplicates if a response
   * was lost mid-flight (slow/flaky connection causing unnecessary retries).
   */
  idempotencyKey?: string;
}

export interface PendingFeedback {
  id?: number; // Auto-increment
  screenshot: string; // data URL
  route: string;
  note: string;
  type: string; // 'bug' | 'suggestion' | 'praise'
  metadata: object; // collected device/session metadata
  viewport: { width: number; height: number };
  timestamp: string;
  retryCount: number;
  lastError?: string;
  createdAt: number; // Date.now()
}

export interface Metadata {
  key: string;
  value: unknown;
}
