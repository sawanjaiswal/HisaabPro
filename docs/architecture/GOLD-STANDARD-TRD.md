# Gold Standard Architecture — TRD (Technical Reference Document)

> **Status:** Draft — Pending Approval
> **Date:** 2026-04-02
> **Companion:** [GOLD-STANDARD-PRD.md](./GOLD-STANDARD-PRD.md)
> **Audience:** Developers implementing the upgrades

---

## 1. System Architecture (Target State)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│  React 19 + TypeScript + Tailwind 4 + Capacitor 8              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ TanStack     │  │ Zustand      │  │ Dexie (IndexedDB)    │  │
│  │ Query        │  │ (client      │  │ (offline replica +   │  │
│  │ (server      │  │  state)      │  │  sync queue)         │  │
│  │  state)      │  │              │  │                      │  │
│  └──────┬───────┘  └──────────────┘  └──────────┬───────────┘  │
│         │                                        │              │
│         │  ┌────────────────────────────┐        │              │
│         ├──│ useSSE() — real-time sync  │────────┤              │
│         │  └────────────────────────────┘        │              │
│         │                                        │              │
│  ┌──────▼────────────────────────────────────────▼──────────┐  │
│  │              API Service Layer (src/lib/api.ts)           │  │
│  │         fetch() with auth cookies + CSRF token            │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────┼───────────────────────────────────┐
│                        SERVER LAYER                             │
│                                                                 │
│  Express + TypeScript                                           │
│                                                                 │
│  Request Pipeline:                                              │
│  ┌────────┐ ┌──────┐ ┌──────┐ ┌────────────┐ ┌──────────────┐ │
│  │Rate    │→│CSRF  │→│Auth  │→│Subscription│→│Permission    │ │
│  │Limit   │ │Check │ │JWT   │ │Gate        │ │(resource ×   │ │
│  │(4-tier)│ │      │ │      │ │(plan check)│ │ action)      │ │
│  └────────┘ └──────┘ └──────┘ └────────────┘ └──────┬───────┘ │
│                                                       │         │
│  ┌────────────────────────────────────────────────────▼──────┐ │
│  │                    Route Handlers                          │ │
│  │  Zod validation → Service Layer → Response                │ │
│  └────────────────────────────────┬──────────────────────────┘ │
│                                    │                            │
│  ┌─────────────────────────────────▼─────────────────────────┐ │
│  │                   Service Layer                            │ │
│  │  Business logic → Prisma queries → Audit log → SSE emit  │ │
│  └─────────────┬──────────────────────────┬──────────────────┘ │
│                │                           │                    │
│  ┌─────────────▼──────────┐  ┌────────────▼───────────────┐   │
│  │  PostgreSQL (Neon)     │  │  SSE Event Bus             │   │
│  │  68 models · pooled    │  │  Per-business broadcast    │   │
│  │  Soft delete on all    │  │  → TanStack invalidation   │   │
│  └────────────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. TanStack Query Migration

### 2.1 Package Setup

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### 2.2 Provider Setup

```typescript
// src/providers/QueryProvider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — data fresh for 30s
      gcTime: 5 * 60_000,       // 5min — garbage collect after 5min
      retry: 2,                  // retry failed queries 2x
      refetchOnWindowFocus: true, // refetch when tab gains focus
      refetchOnReconnect: true,  // refetch when network returns
    },
    mutations: {
      retry: 0,                  // don't retry mutations (idempotency handles it)
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

### 2.3 Query Key Convention

```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  // Entity lists
  invoices:     (businessId: string, filters?: object) => ['invoices', businessId, filters] as const,
  payments:     (businessId: string, filters?: object) => ['payments', businessId, filters] as const,
  parties:      (businessId: string, filters?: object) => ['parties', businessId, filters] as const,
  products:     (businessId: string, filters?: object) => ['products', businessId, filters] as const,
  expenses:     (businessId: string, filters?: object) => ['expenses', businessId, filters] as const,

  // Single entities
  invoice:      (id: string) => ['invoice', id] as const,
  payment:      (id: string) => ['payment', id] as const,
  party:        (id: string) => ['party', id] as const,
  product:      (id: string) => ['product', id] as const,

  // Dashboard & reports
  dashboard:    (businessId: string) => ['dashboard', businessId] as const,
  report:       (type: string, businessId: string, params?: object) => ['report', type, businessId, params] as const,

  // Settings
  settings:     (businessId: string) => ['settings', businessId] as const,
  roles:        (businessId: string) => ['roles', businessId] as const,
} as const;
```

### 2.4 Hook Migration Pattern

**Before (current):**
```typescript
// src/features/invoices/useInvoices.ts
export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchInvoices({ signal: controller.signal })
      .then(data => setInvoices(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);
  return { invoices, loading, error, refresh };
}
```

**After (gold standard):**
```typescript
// src/features/invoices/useInvoices.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export function useInvoices(filters?: InvoiceFilters) {
  const { businessId } = useAuth();

  return useQuery({
    queryKey: queryKeys.invoices(businessId, filters),
    queryFn: ({ signal }) => fetchInvoices({ ...filters, signal }),
    enabled: !!businessId,
  });
  // Returns: { data, isLoading, error, refetch, isFetching }
  // Auto-refetch on window focus, reconnect, and SSE invalidation
}
```

**Mutation pattern:**
```typescript
// src/features/invoices/useCreateInvoice.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { businessId } = useAuth();

  return useMutation({
    mutationFn: (data: CreateInvoiceInput) => createInvoice(data),
    onSuccess: () => {
      // Invalidate all invoice lists (any filter combination)
      queryClient.invalidateQueries({ queryKey: ['invoices', businessId] });
      // Also invalidate dashboard (totals change)
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) });
    },
  });
}
```

### 2.5 Optimistic Updates (for fast UI)

```typescript
// Example: toggle invoice status
export function useToggleInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateInvoiceStatus(id, status),

    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['invoice', id] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['invoice', id]);

      // Optimistically update
      queryClient.setQueryData(['invoice', id], (old: Invoice) => ({
        ...old, status,
      }));

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Rollback on error
      queryClient.setQueryData(['invoice', context?.previous?.id], context?.previous);
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
```

### 2.6 Cursor Pagination with useInfiniteQuery

For list endpoints (invoices, payments, parties, etc.), use `useInfiniteQuery` instead of `useQuery`. This replaces the basic useQuery example in 2.4 for list endpoints. Single-entity fetches still use `useQuery`.

```typescript
// src/features/invoices/useInvoices.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export function useInvoices(filters?: InvoiceFilters) {
  const { businessId } = useAuth();
  return useInfiniteQuery({
    queryKey: queryKeys.invoices(businessId, filters),
    queryFn: ({ pageParam, signal }) =>
      fetchInvoices({ ...filters, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!businessId,
  });
  // Returns: { data.pages, fetchNextPage, hasNextPage, isFetchingNextPage }
}
```

**Usage in component:**
```typescript
function InvoiceList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInvoices(filters);

  // Flatten pages into single array
  const invoices = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <>
      {invoices.map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </>
  );
}
```

### 2.7 Migration Order (by feature module)

| Order | Module | Hooks to migrate | Complexity |
|-------|--------|-----------------|------------|
| 1 | Dashboard | 1 (useDashboard) | LOW — single query |
| 2 | Parties | 3 (useParties, usePartyDetail, usePartyForm) | LOW |
| 3 | Products | 3 (useProducts, useProductDetail, useProductForm) | LOW |
| 4 | Invoices | 4 (useInvoices, useInvoiceDetail, useCreateInvoice, useEditInvoice) | MEDIUM |
| 5 | Payments | 3 (usePayments, usePaymentDetail, useRecordPayment) | MEDIUM |
| 6 | Reports | 6 (one per report type) | LOW — read-only |
| 7 | Settings | 5 (useRoles, useStaff, useAuditLog, etc.) | LOW |
| 8 | Expenses | 2 | LOW |
| 9 | Accounting | 4 | MEDIUM |
| 10 | Templates | 2 | LOW |
| 11 | Inventory (batches, godowns, serials, stock-verify) | 8 | MEDIUM |
| 12 | Tax/GST | 4 | LOW |
| 13 | Remaining (coupons, recurring, bill-scan, etc.) | ~5 | LOW |

**Total: ~50 hooks. Estimate: 2 weeks.**

---

## 3. Soft Delete Implementation

### 3.1 Schema Changes

Add to every business-data model that doesn't already have it:

```prisma
// Template — add these 3 lines to each model
isDeleted       Boolean   @default(false)
deletedAt       DateTime?
@@index([businessId, isDeleted])
```

### 3.2 Models Requiring Migration

Already have soft delete (6): `Document`, `Payment`, `StockMovement`, `Batch`, `SerialNumber`, `PaymentDiscount`

Need soft delete added (25+):
```
Party, PartyGroup, PartyAddress, PartyPricing, OpeningBalance,
Product, Category, Unit, UnitConversion,
DocumentNumberSeries, DocumentAdditionalCharge,
TermsAndConditionsTemplate, DocumentSettings,
TaxCategory,
Expense, ExpenseCategory, OtherIncome,
BankAccount, LedgerAccount, JournalEntry, JournalEntryLine,
Cheque, Loan, LoanTransaction,
Role, StaffInvite,
Godown, GodownTransfer,
StockVerification, StockAlert,
RecurringInvoice,
CustomField, CustomFieldValue,
PriceList, PriceListItem
```

### 3.3 Prisma Middleware (Global Filter)

```typescript
// server/src/lib/prisma-soft-delete.ts
import { Prisma } from '@prisma/client';

const SOFT_DELETE_MODELS = [
  'Party', 'Product', 'Document', 'Payment', 'Expense',
  // ... full list
];

// Extend Prisma client
prisma.$use(async (params, next) => {
  if (!SOFT_DELETE_MODELS.includes(params.model ?? '')) return next(params);

  // findMany / findFirst — auto-filter deleted
  if (params.action === 'findMany' || params.action === 'findFirst') {
    if (!params.args) params.args = {};
    if (!params.args.where) params.args.where = {};
    if (params.args.where.isDeleted === undefined) {
      params.args.where.isDeleted = false;
    }
  }

  // delete → soft delete
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { isDeleted: true, deletedAt: new Date() };
  }

  // deleteMany → soft delete many
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    if (!params.args) params.args = {};
    params.args.data = { isDeleted: true, deletedAt: new Date() };
  }

  return next(params);
});
```

### 3.4 Recycle Bin API (Generic)

```typescript
// server/src/routes/recycle-bin.ts
// Generic recycle bin for any soft-deletable entity

GET  /api/recycle-bin?entityType=party&businessId=xxx
// Returns: soft-deleted records of that type

POST /api/recycle-bin/:entityType/:id/restore
// Sets isDeleted=false, deletedAt=null

DELETE /api/recycle-bin/:entityType/:id/permanent
// requireOwner() + audit log + actual delete (after retention period)
```

### 3.5 Cascade Rules

When soft-deleting a parent entity, follow these cascade rules:

| Parent Deleted | Cascade Soft-Delete | Keep Visible | Notes |
|---|---|---|---|
| **Party** | PartyAddresses, PartyPricing, OpeningBalances | Documents, Payments | Documents/Payments show party name from snapshot (denormalized at creation) |
| **Product** | Batches, SerialNumbers | Documents (line items) | Line items store snapshot: name, HSN, price, tax at time of creation |
| **Godown** | — (BLOCKED) | — | Cannot soft-delete if stock exists. Force stock transfer to another godown first |
| **Role** | — (BLOCKED) | — | Cannot soft-delete if any BusinessUser references it. Reassign all users first |

**General rule:** Financial records (`Document`, `Payment`, `JournalEntry`, `JournalEntryLine`) are **NEVER** cascade-deleted. They reference parties and products by snapshot data, not live foreign keys. This ensures audit trail integrity even when the referenced entity is deleted.

```typescript
// server/src/services/soft-delete-cascade.ts

export async function softDeleteParty(partyId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.party.update({ where: { id: partyId }, data: { isDeleted: true, deletedAt: new Date() } });
    await tx.partyAddress.updateMany({ where: { partyId }, data: { isDeleted: true, deletedAt: new Date() } });
    await tx.partyPricing.updateMany({ where: { partyId }, data: { isDeleted: true, deletedAt: new Date() } });
    await tx.openingBalance.updateMany({ where: { partyId }, data: { isDeleted: true, deletedAt: new Date() } });
  });
}

export async function softDeleteProduct(productId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { isDeleted: true, deletedAt: new Date() } });
    await tx.batch.updateMany({ where: { productId }, data: { isDeleted: true, deletedAt: new Date() } });
    await tx.serialNumber.updateMany({ where: { productId }, data: { isDeleted: true, deletedAt: new Date() } });
  });
}

export async function softDeleteGodown(godownId: string) {
  const stockCount = await prisma.stockMovement.count({ where: { godownId, isDeleted: false } });
  if (stockCount > 0) throw new AppError(400, 'STOCK_EXISTS', 'Transfer all stock before deleting godown');
  return prisma.godown.update({ where: { id: godownId }, data: { isDeleted: true, deletedAt: new Date() } });
}

export async function softDeleteRole(roleId: string) {
  const userCount = await prisma.businessUser.count({ where: { roleId } });
  if (userCount > 0) throw new AppError(400, 'ROLE_IN_USE', 'Reassign all users before deleting role');
  return prisma.role.update({ where: { id: roleId }, data: { isDeleted: true, deletedAt: new Date() } });
}
```

### 3.6 Migration Script

```sql
-- Single migration: add isDeleted + deletedAt to all models
-- Prisma migration: npx prisma migrate dev --name add-soft-delete-everywhere

ALTER TABLE "Party" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Party" ADD COLUMN "deletedAt" TIMESTAMP;
CREATE INDEX "Party_businessId_isDeleted_idx" ON "Party"("businessId", "isDeleted");
-- ... repeat for each model
```

---

## 4. SSE Real-Time Sync

### 4.1 Server Implementation

```typescript
// server/src/services/sse.service.ts
import { Response } from 'express';

interface SSEClient {
  id: string;
  userId: string;
  res: Response;
}

// Per-business client registry
const clients = new Map<string, Set<SSEClient>>();

export function addClient(businessId: string, client: SSEClient) {
  if (!clients.has(businessId)) clients.set(businessId, new Set());
  clients.get(businessId)!.add(client);
}

export function removeClient(businessId: string, client: SSEClient) {
  clients.get(businessId)?.delete(client);
  if (clients.get(businessId)?.size === 0) clients.delete(businessId);
}

export function broadcast(businessId: string, event: {
  type: string;
  entityId?: string;
  userId: string;   // who triggered it
  timestamp: number;
}) {
  const businessClients = clients.get(businessId);
  if (!businessClients) return;

  const data = JSON.stringify(event);
  for (const client of businessClients) {
    // Don't send to the user who triggered the event (they already have it)
    if (client.userId === event.userId) continue;
    client.res.write(`data: ${data}\n\n`);
  }
}

// Heartbeat to keep connections alive
setInterval(() => {
  for (const [, businessClients] of clients) {
    for (const client of businessClients) {
      client.res.write(`:heartbeat\n\n`);
    }
  }
}, 30_000); // every 30s
```

### 4.2 SSE Endpoint

```typescript
// server/src/routes/events.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { addClient, removeClient } from '../services/sse.service';

const router = Router();

router.get('/stream', authenticate, (req, res) => {
  const { userId, businessId } = req.user;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable Nginx buffering
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  const client = { id: crypto.randomUUID(), userId, res };
  addClient(businessId, client);

  // Cleanup on disconnect
  req.on('close', () => {
    removeClient(businessId, client);
  });
});

export default router;
```

### 4.3 Emitting Events from Services

```typescript
// server/src/services/document.service.ts
import { broadcast } from './sse.service';

async function createDocument(data: CreateDocumentInput, userId: string, businessId: string) {
  const doc = await prisma.document.create({ data: { ...data, businessId } });

  // Audit log (already exists)
  await auditLog({ action: 'CREATE', entityType: 'Document', entityId: doc.id, userId });

  // SSE broadcast (NEW)
  broadcast(businessId, {
    type: 'DOCUMENT_CREATED',
    entityId: doc.id,
    userId,
    timestamp: Date.now(),
  });

  return doc;
}
```

### 4.4 Frontend SSE Hook

```typescript
// src/hooks/useSSE.ts
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { API_URL } from '@/config/app.config';

// Map SSE event types to query key prefixes
const EVENT_TO_QUERY: Record<string, string[]> = {
  DOCUMENT_CREATED:  ['invoices', 'dashboard'],
  DOCUMENT_UPDATED:  ['invoices', 'invoice', 'dashboard'],
  DOCUMENT_DELETED:  ['invoices', 'dashboard'],
  PAYMENT_CREATED:   ['payments', 'dashboard', 'invoices'],
  PAYMENT_UPDATED:   ['payments', 'dashboard'],
  PARTY_CREATED:     ['parties'],
  PARTY_UPDATED:     ['parties', 'party'],
  PRODUCT_CREATED:   ['products'],
  PRODUCT_UPDATED:   ['products', 'product'],
  STOCK_ADJUSTED:    ['products', 'dashboard'],
  EXPENSE_CREATED:   ['expenses', 'dashboard'],
};

export function useSSE() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const source = new EventSource(`${API_URL}/events/stream`, {
      withCredentials: true,
    });

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'CONNECTED') return;

        const queryPrefixes = EVENT_TO_QUERY[event.type];
        if (!queryPrefixes) return;

        // Invalidate all matching query caches
        for (const prefix of queryPrefixes) {
          queryClient.invalidateQueries({ queryKey: [prefix] });
        }
      } catch {
        // Ignore parse errors (heartbeats, etc.)
      }
    };

    source.onerror = () => {
      // EventSource auto-reconnects. No action needed.
      // Browser will retry with exponential backoff.
    };

    return () => source.close();
  }, [isAuthenticated, queryClient]);
}
```

### 4.5 Event Types (Complete List)

```typescript
// server/src/types/sse.types.ts
export type SSEEventType =
  // Documents
  | 'DOCUMENT_CREATED' | 'DOCUMENT_UPDATED' | 'DOCUMENT_DELETED' | 'DOCUMENT_RESTORED'
  // Payments
  | 'PAYMENT_CREATED' | 'PAYMENT_UPDATED' | 'PAYMENT_DELETED'
  // Parties
  | 'PARTY_CREATED' | 'PARTY_UPDATED' | 'PARTY_DELETED'
  // Products
  | 'PRODUCT_CREATED' | 'PRODUCT_UPDATED' | 'PRODUCT_DELETED'
  // Stock
  | 'STOCK_ADJUSTED' | 'STOCK_TRANSFERRED'
  // Expenses
  | 'EXPENSE_CREATED' | 'EXPENSE_UPDATED' | 'EXPENSE_DELETED'
  // Settings
  | 'ROLE_UPDATED' | 'STAFF_INVITED' | 'SETTINGS_CHANGED'
  // System
  | 'CONNECTED' | 'SUBSCRIPTION_CHANGED';
```

### 4.6 Scaling SSE with Redis

**Problem:** The in-memory `Map<string, Set<SSEClient>>` only holds clients connected to a single server instance. When running multiple Render instances behind a load balancer, a mutation on instance A won't notify SSE clients on instance B.

**Solution:** Use Redis pub/sub as an event bus between instances.

```typescript
// server/src/services/sse-redis.ts
import Redis from 'ioredis';

const pub = new Redis(process.env.REDIS_URL!);
const sub = new Redis(process.env.REDIS_URL!);

// Publish events to Redis (replaces direct broadcast)
export function broadcastEvent(businessId: string, event: SSEEvent) {
  pub.publish(`sse:${businessId}`, JSON.stringify(event));
}

// Each instance subscribes and forwards to local clients
sub.psubscribe('sse:*');
sub.on('pmessage', (_pattern, channel, message) => {
  const businessId = channel.split(':')[1];
  const localClients = clients.get(businessId);
  if (!localClients) return;
  for (const client of localClients) {
    client.res.write(`data: ${message}\n\n`);
  }
});
```

**How it works:**
1. Service layer calls `broadcastEvent()` instead of `broadcast()`
2. Event goes to Redis, not directly to local clients
3. Every server instance (including the sender) receives the Redis message
4. Each instance forwards the message to its own local SSE clients

**Fallback:** Without Redis (`REDIS_URL` not set), fall back to in-memory broadcast. This works fine for single-instance deployment and local development.

### 4.7 Mobile Strategy

Capacitor native apps should **NOT** use SSE — it drains battery and the OS kills background connections.

| Platform | Real-Time Strategy |
|---|---|
| **Web (browser)** | SSE (as described above) |
| **Capacitor (iOS/Android)** | FCM push notification on mutation → app receives push → invalidates TanStack Query cache |
| **App resume (foreground)** | `queryClient.invalidateQueries()` to refetch everything stale |

```typescript
// src/hooks/useRealtime.ts
import { Capacitor } from '@capacitor/core';

export function useRealtime() {
  if (Capacitor.isNativePlatform()) {
    usePolling();     // FCM push + poll on resume
  } else {
    useSSE();         // Full SSE for web
  }
}
```

**On app resume:**
```typescript
import { App } from '@capacitor/app';

App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    queryClient.invalidateQueries(); // refetch all stale queries
  }
});
```

---

## 5. Permission Matrix

### 5.1 Schema

```prisma
model RoleGrant {
  id         String   @id @default(cuid())
  roleId     String
  resource   String   // e.g., "invoice", "payment"
  actions    String[] // e.g., ["create", "read", "update"]
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, resource])
  @@index([roleId])
}
```

### 5.2 Resources & Actions

```typescript
// server/src/config/permissions.ts

export const RESOURCES = [
  'invoice', 'payment', 'party', 'product', 'expense',
  'report', 'settings', 'staff', 'bank_account', 'journal',
  'cheque', 'loan', 'godown', 'batch', 'serial_number',
  'template', 'tax', 'recurring', 'pos',
] as const;

export const ACTIONS = ['create', 'read', 'update', 'delete', 'export'] as const;

export type Resource = typeof RESOURCES[number];
export type Action = typeof ACTIONS[number];

// Default role templates
export const ROLE_TEMPLATES = {
  owner: {
    // All resources, all actions — computed, not stored
  },
  manager: {
    invoice:     ['create', 'read', 'update', 'delete', 'export'],
    payment:     ['create', 'read', 'update', 'delete'],
    party:       ['create', 'read', 'update'],
    product:     ['create', 'read', 'update'],
    expense:     ['create', 'read', 'update'],
    report:      ['read', 'export'],
    staff:       ['read'],
    settings:    ['read'],
    bank_account:['read'],
    template:    ['read', 'update'],
  },
  cashier: {
    invoice:     ['create', 'read'],
    payment:     ['create', 'read'],
    party:       ['read'],
    product:     ['read'],
    report:      [],
    pos:         ['create', 'read'],
  },
  viewer: {
    invoice:     ['read'],
    payment:     ['read'],
    party:       ['read'],
    product:     ['read'],
    report:      ['read'],
  },
} as const;
```

### 5.3 Middleware

```typescript
// server/src/middleware/permission.ts (updated)
import { Resource, Action } from '../config/permissions';

export function requirePermission(resource: Resource, action: Action) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { userId, businessId } = req.user;

    // Owner bypass — owners have all permissions
    const businessUser = await prisma.businessUser.findUnique({
      where: { userId_businessId: { userId, businessId } },
      include: { roleRef: { include: { grants: true } } },
    });

    if (!businessUser) return res.status(403).json({ success: false, error: 'Not a member' });
    if (businessUser.role === 'OWNER') return next(); // owner = god mode

    // Check grants
    const grant = businessUser.roleRef?.grants.find(g => g.resource === resource);
    if (grant?.actions.includes(action)) return next();

    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      required: { resource, action },
    });
  };
}

// Backward compatibility — maps old string permissions to new format
// OLD: requirePermission("create_bill")
// NEW: requirePermission("invoice", "create")
const LEGACY_MAP: Record<string, [Resource, Action]> = {
  'create_bill':    ['invoice', 'create'],
  'edit_bill':      ['invoice', 'update'],
  'delete_bill':    ['invoice', 'delete'],
  'view_reports':   ['report', 'read'],
  'manage_parties': ['party', 'update'],
  'manage_products':['product', 'update'],
  'manage_payments':['payment', 'create'],
  // ... full mapping
};
```

### 5.4 Field-Level Permission Filtering

Beyond resource-level access, some roles should not see sensitive financial fields (e.g., a cashier shouldn't see purchase prices or profit margins).

```typescript
// server/src/middleware/field-filter.ts
const RESTRICTED_FIELDS: Record<string, Record<string, string[]>> = {
  invoice: {
    cashier: ['purchasePrice', 'profitMargin', 'costPrice'],
    viewer: ['purchasePrice', 'profitMargin', 'costPrice', 'supplierName'],
  },
  product: {
    cashier: ['purchasePrice', 'supplier', 'margin'],
  },
};

export function filterRestrictedFields(resource: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const role = req.user?.roleName;
      const restricted = RESTRICTED_FIELDS[resource]?.[role];
      if (restricted && body?.data) {
        body.data = stripFields(body.data, restricted);
      }
      return originalJson(body);
    };
    next();
  };
}

function stripFields(data: any, fields: string[]): any {
  if (Array.isArray(data)) return data.map(item => stripFields(item, fields));
  if (typeof data !== 'object' || data === null) return data;
  const result = { ...data };
  for (const field of fields) delete result[field];
  return result;
}
```

**Usage in routes:**
```typescript
router.get('/invoices', authenticate, filterRestrictedFields('invoice'), getInvoices);
router.get('/products', authenticate, filterRestrictedFields('product'), getProducts);
```

### 5.5 Migration from String[] to RoleGrant

```typescript
// server/src/scripts/migrate-permissions.ts
async function migratePermissions() {
  const roles = await prisma.role.findMany();

  for (const role of roles) {
    const grants = new Map<string, Set<string>>();

    for (const perm of role.permissions) {
      const mapped = LEGACY_MAP[perm];
      if (!mapped) continue;
      const [resource, action] = mapped;
      if (!grants.has(resource)) grants.set(resource, new Set());
      grants.get(resource)!.add(action);
    }

    for (const [resource, actions] of grants) {
      await prisma.roleGrant.upsert({
        where: { roleId_resource: { roleId: role.id, resource } },
        create: { roleId: role.id, resource, actions: [...actions] },
        update: { actions: [...actions] },
      });
    }
  }
}
```

---

## 6. Subscription Gating

### 6.1 Schema Additions

```prisma
model Subscription {
  id             String   @id @default(cuid())
  businessId     String   @unique
  plan           Plan     @default(FREE)
  status         SubscriptionStatus @default(ACTIVE)
  razorpaySubId  String?  @unique
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelledAt    DateTime?
  business       Business @relation(fields: [businessId], references: [id])
}

enum Plan {
  FREE
  PRO
  BUSINESS
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}
```

### 6.2 Plan Limits Configuration

```typescript
// server/src/config/plans.ts

export const PLAN_LIMITS = {
  FREE: {
    maxUsers: 1,
    maxInvoicesPerMonth: 50,
    maxProducts: 100,
    features: {
      gst: false,
      customRoles: false,
      multiGodown: false,
      pos: false,
      tallyExport: false,
      eInvoicing: false,
      recurring: false,
      bulkImport: false,
    },
  },
  PRO: {
    maxUsers: 3,
    maxInvoicesPerMonth: -1, // unlimited
    maxProducts: -1,
    features: {
      gst: true,
      customRoles: true,
      multiGodown: false,
      pos: false,
      tallyExport: false,
      eInvoicing: false,
      recurring: true,
      bulkImport: true,
    },
  },
  BUSINESS: {
    maxUsers: -1,
    maxInvoicesPerMonth: -1,
    maxProducts: -1,
    features: {
      gst: true,
      customRoles: true,
      multiGodown: true,
      pos: true,
      tallyExport: true,
      eInvoicing: true,
      recurring: true,
      bulkImport: true,
    },
  },
} as const;

export const PLAN_HIERARCHY = { FREE: 0, PRO: 1, BUSINESS: 2 } as const;
```

### 6.3 Gating Middleware

```typescript
// server/src/middleware/subscription-gate.ts

export function requireFeature(feature: keyof typeof PLAN_LIMITS.FREE.features) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const sub = await getSubscription(req.user.businessId);
    const plan = sub?.plan || 'FREE';
    const limits = PLAN_LIMITS[plan];

    if (limits.features[feature]) return next();

    return res.status(402).json({
      success: false,
      error: 'UPGRADE_REQUIRED',
      feature,
      requiredPlan: getMinPlanForFeature(feature),
      currentPlan: plan,
    });
  };
}

export function requireQuota(resource: 'invoices' | 'users' | 'products') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const sub = await getSubscription(req.user.businessId);
    const plan = sub?.plan || 'FREE';
    const limit = PLAN_LIMITS[plan][`max${capitalize(resource)}PerMonth`]
                  ?? PLAN_LIMITS[plan][`max${capitalize(resource)}`];

    if (limit === -1) return next(); // unlimited

    const usage = await countMonthlyUsage(req.user.businessId, resource);
    if (usage < limit) return next();

    return res.status(402).json({
      success: false,
      error: 'QUOTA_EXCEEDED',
      resource,
      usage,
      limit,
      currentPlan: plan,
    });
  };
}
```

### 6.4 Route Integration Examples

```typescript
// GST routes — Pro+ only
router.post('/gst/returns', authenticate, requireFeature('gst'), ...);

// Multi-godown — Business only
router.post('/godowns', authenticate, requireFeature('multiGodown'), ...);

// Invoice creation — quota check
router.post('/documents', authenticate, requireQuota('invoices'), ...);

// Staff invite — user quota check
router.post('/staff/invite', authenticate, requireQuota('users'), ...);
```

---

## 7. Offline Conflict Resolution

### 7.1 Sync Queue Enhancement

```typescript
// src/lib/offline-sync.ts (enhanced)

interface SyncQueueEntry {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body: unknown;
  createdAt: number;            // when user made the change
  entityType: string;           // 'invoice', 'payment', etc.
  entityId?: string;            // for updates/deletes
  clientUpdatedAt: number;      // timestamp of the data version user was editing
}
```

### 7.2 Server Conflict Detection

```typescript
// server/src/middleware/conflict-detection.ts

export function detectConflict(modelName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { clientUpdatedAt } = req.body;
    if (!clientUpdatedAt || !req.params.id) return next(); // skip for creates

    const record = await prisma[modelName].findUnique({
      where: { id: req.params.id },
      select: { updatedAt: true },
    });

    if (!record) return next(); // record doesn't exist, no conflict

    const serverUpdatedAt = record.updatedAt.getTime();
    const clientTimestamp = new Date(clientUpdatedAt).getTime();

    if (serverUpdatedAt > clientTimestamp) {
      // CONFLICT — server has newer data
      return res.status(409).json({
        success: false,
        error: 'CONFLICT',
        serverUpdatedAt: record.updatedAt,
        clientUpdatedAt,
        message: 'This record was modified by another user while you were offline.',
      });
    }

    return next(); // no conflict, proceed
  };
}
```

### 7.3 Frontend Conflict Handling

```typescript
// src/hooks/useSyncQueue.ts (enhanced)

async function processQueue() {
  for (const entry of queue) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        body: JSON.stringify({ ...entry.body, clientUpdatedAt: entry.clientUpdatedAt }),
      });

      if (response.status === 409) {
        // CONFLICT
        const conflict = await response.json();
        addConflict({
          entry,
          serverUpdatedAt: conflict.serverUpdatedAt,
          resolvedAt: null,
        });
        toast.warning(`${entry.entityType} was modified by another user. Review in Settings → Sync Conflicts.`);
        continue; // skip this entry, move to next
      }

      if (response.ok) {
        removeFromQueue(entry.id);
      }
    } catch {
      // Network error — will retry on next sync
      break;
    }
  }
}
```

---

## 8. Multi-Device Session Management

### 8.1 Schema

```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  deviceInfo   String   // parsed from User-Agent
  ipAddress    String
  lastActiveAt DateTime @default(now()) @updatedAt
  createdAt    DateTime @default(now())
  isRevoked    Boolean  @default(false)
  tokenHash    String   @unique  // hash of refresh token — for targeted revocation
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRevoked])
  @@index([tokenHash])
}
```

### 8.2 Integration with Auth

```typescript
// On login: create session
const session = await prisma.session.create({
  data: {
    userId,
    deviceInfo: parseUserAgent(req.headers['user-agent']),
    ipAddress: req.ip,
    tokenHash: hashToken(refreshToken),
  },
});

// On token refresh: update lastActiveAt
await prisma.session.update({
  where: { tokenHash: hashToken(oldRefreshToken) },
  data: { lastActiveAt: new Date(), tokenHash: hashToken(newRefreshToken) },
});

// On auth middleware: check session not revoked
const session = await prisma.session.findUnique({
  where: { tokenHash: hashToken(refreshToken) },
});
if (!session || session.isRevoked) return unauthorized();
```

---

## 9. Data Export

### 9.1 Export Service

```typescript
// server/src/services/export.service.ts

export async function generateFullExport(businessId: string): Promise<string> {
  const zip = new JSZip();

  // Parties
  const parties = await prisma.party.findMany({ where: { businessId, isDeleted: false } });
  zip.file('parties.csv', toCSV(parties, PARTY_COLUMNS));

  // Products
  const products = await prisma.product.findMany({ where: { businessId, isDeleted: false } });
  zip.file('products.csv', toCSV(products, PRODUCT_COLUMNS));

  // Invoices (streamed — could be large)
  const invoices = await streamInvoices(businessId);
  zip.file('invoices.csv', toCSV(invoices, INVOICE_COLUMNS));

  // Payments
  const payments = await prisma.payment.findMany({ where: { businessId, isDeleted: false } });
  zip.file('payments.csv', toCSV(payments, PAYMENT_COLUMNS));

  // Expenses
  const expenses = await prisma.expense.findMany({ where: { businessId, isDeleted: false } });
  zip.file('expenses.csv', toCSV(expenses, EXPENSE_COLUMNS));

  // Generate and upload to temporary storage
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const filePath = `/tmp/exports/${businessId}-${Date.now()}.zip`;
  await fs.writeFile(filePath, buffer);

  return filePath;
}
```

### 9.2 Export Endpoint

```typescript
// Rate limited: 1 per day per business
router.post('/export/full',
  authenticate,
  requireOwner(),
  rateLimiter({ max: 1, windowMs: 24 * 60 * 60 * 1000 }),
  async (req, res) => {
    const filePath = await generateFullExport(req.user.businessId);
    // Return download URL (signed, 24h expiry)
    res.json({ success: true, data: { downloadUrl: signUrl(filePath, '24h') } });
  }
);
```

---

## 10. Connection Pooling

### 10.1 Prisma Configuration

```env
# .env
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=10&pool_timeout=30"
DIRECT_URL="postgresql://user:pass@host/db"  # for migrations (no pooler)
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 10.2 Neon-Specific Settings

```env
# Neon connection pooler (PgBouncer built-in)
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require&pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require"
```

---

## 11. File Organization (New Files)

```
server/src/
├── config/
│   ├── permissions.ts          # Resource × Action constants
│   └── plans.ts                # Subscription tier limits
├── middleware/
│   ├── subscription-gate.ts    # Plan + quota checking
│   ├── conflict-detection.ts   # Offline conflict detection
│   ├── field-filter.ts         # Field-level permission filtering
│   └── api-version.ts          # Accept header API versioning
├── services/
│   ├── sse.service.ts          # SSE event bus (in-memory)
│   ├── sse-redis.ts            # SSE Redis pub/sub adapter
│   ├── soft-delete-cascade.ts  # Cascade rules for soft delete
│   └── export.service.ts       # Full data export
├── routes/
│   ├── events.ts               # SSE endpoint
│   └── export.ts               # Export endpoints
├── scripts/
│   └── migrate-permissions.ts  # String[] → RoleGrant migration
└── lib/
    ├── prisma-soft-delete.ts   # Global soft delete middleware
    └── redis.ts                # Redis connection (ioredis, lazy-connect)

src/
├── providers/
│   └── QueryProvider.tsx       # TanStack Query setup
├── lib/
│   └── query-keys.ts           # Centralized query key factory
├── hooks/
│   ├── useSSE.ts               # Real-time event listener (web)
│   ├── useRealtime.ts          # Platform-aware: SSE vs FCM
│   └── useSubscription.ts      # Plan-aware feature checks
├── test-utils.tsx              # renderWithQuery + MSW setup
├── mocks/
│   └── handlers.ts             # MSW request handlers
└── features/
    └── settings/
        └── SessionsPage.tsx    # Active sessions management
```

---

## 12. Testing Strategy

| Upgrade | Test Type | What to Verify |
|---------|----------|---------------|
| TanStack Query | Unit + Integration | Cache invalidation, optimistic rollback, error retry, useInfiniteQuery pagination |
| Soft Delete | Integration | `findMany` excludes deleted, restore works, cascade rules, audit logged |
| SSE | Integration | Multi-tab sync, reconnect, heartbeat, Redis pub/sub cross-instance |
| Permission Matrix | Unit + Integration | Grant check, owner bypass, legacy mapping, field-level filtering |
| Subscription Gate | Unit | Quota enforcement, feature gates, 402 responses, all 3 tiers × each feature |
| Conflict Detection | Integration | 409 on conflict, clean merge on no-conflict |
| Sessions | Integration | Create, list, revoke, force-logout-all |
| Data Export | Integration | ZIP contains all data, CSV parseable, signed URL expires |
| API Versioning | Unit | Version parsing from Accept header, default to v1, sunset headers |
| Redis | Integration | Connection, fallback to in-memory when unavailable |

---

## 13. Deployment Notes

- **SSE on Render:** Render supports long-lived connections. Set `X-Accel-Buffering: no` header. Max ~100 concurrent SSE per instance.
- **Prisma migration:** Run `npx prisma migrate dev --name gold-standard-soft-delete` for schema changes. Use `directUrl` (not pooled URL) for migrations.
- **TanStack Query:** Frontend-only change. No backend deployment needed.
- **Zero downtime:** All changes are additive. No breaking changes to existing API contracts.

---

## 14. API Versioning Strategy

No URL versioning (`/v1/`, `/v2/`). Use **Accept header versioning** instead.

### 14.1 Convention

| Header | Behavior |
|---|---|
| `Accept: application/json` | Default to latest version (currently v1) |
| `Accept: application/json; version=1` | Explicit v1 |
| `Accept: application/json; version=2` | v2 (when breaking changes are introduced) |

### 14.2 Version Middleware

```typescript
// server/src/middleware/api-version.ts
export function apiVersion(req: Request, res: Response, next: NextFunction) {
  const accept = req.headers.accept || '';
  const match = accept.match(/version=(\d+)/);
  req.apiVersion = match ? parseInt(match[1]) : 1;
  next();
}
```

### 14.3 Using in Routes

```typescript
// When a breaking change is needed
router.get('/invoices', authenticate, apiVersion, (req, res) => {
  if (req.apiVersion >= 2) {
    return getInvoicesV2(req, res); // new response shape
  }
  return getInvoicesV1(req, res);   // original response shape
});
```

### 14.4 Sunset Policy

- Current API = **version 1** (implicit, no header needed)
- Breaking changes get a new version number
- Old versions sunset **6 months** after the new version ships
- Deprecated versions return `Sunset` and `Deprecation` headers:

```typescript
if (req.apiVersion < CURRENT_VERSION) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', '2027-01-01T00:00:00Z');
  res.setHeader('Link', '</docs/migration>; rel="deprecation"');
}
```

---

## 15. Redis Architecture

Redis is **REQUIRED for production** (not optional). It backs multiple critical subsystems.

### 15.1 Uses

| Feature | Redis Structure | Purpose |
|---|---|---|
| Rate limiting | Sorted sets / counters | 4-tier rate limiting across instances |
| SSE pub/sub | Pub/sub channels | Cross-instance real-time broadcast (Section 4.6) |
| Session cache | Key-value | Fast session lookup without DB hit |
| Token blacklist | Key-value with TTL | Revoked JWT tracking until expiry |

### 15.2 Provider & Connection

- **Provider:** Upstash (serverless Redis, free tier: 10K commands/day)
- **Client:** Single `ioredis` instance with lazy-connect

```typescript
// server/src/lib/redis.ts
import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null; // fallback to in-memory for dev
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
    redis.connect().catch(console.error);
  }
  return redis;
}
```

### 15.3 Key Namespace

All keys follow the pattern `hp:{feature}:{id}`:

```
hp:rate:192.168.1.1          — rate limit counter for IP
hp:rate:user:abc123           — rate limit counter for user
hp:sse:businessId             — SSE pub/sub channel
hp:session:userId             — cached session data
hp:blacklist:tokenJti         — revoked JWT (TTL = token expiry)
```

### 15.4 Fallback (Development)

Without `REDIS_URL`, all features fall back to in-memory stores:
- Rate limiting: already uses in-memory Map (existing implementation)
- SSE: in-memory broadcast (single-instance only)
- Session cache: direct Prisma query
- Token blacklist: in-memory Set

---

## 16. Testing Strategy Evolution

### 16.1 TanStack Query Test Utility

All components using TanStack Query hooks need a `QueryClientProvider` wrapper in tests.

```typescript
// src/test-utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';

export function renderWithQuery(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    options
  );
}
```

### 16.2 API Mocking with MSW

Use `msw` (Mock Service Worker) for API mocking — not manual `jest.fn()` mocks.

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/invoices', ({ request }) => {
    return HttpResponse.json({
      success: true,
      data: { items: mockInvoices, nextCursor: null },
    });
  }),
];
```

### 16.3 SSE Integration Tests

Use `eventsource` polyfill in Node for testing SSE connections:

```typescript
import EventSource from 'eventsource';

test('SSE broadcasts document creation to other users', async () => {
  const source = new EventSource(`${BASE_URL}/events/stream`, {
    headers: { Cookie: userBCookie },
  });

  // Trigger mutation as user A
  await createInvoice(userAToken, invoiceData);

  // Assert user B receives the event
  const event = await waitForSSEEvent(source, 'DOCUMENT_CREATED');
  expect(event.entityId).toBeDefined();
  source.close();
});
```

### 16.4 Permission Tests

Test both grant and deny paths for every resource × action combination:

```typescript
describe('Permission: invoice × create', () => {
  it('allows manager to create invoice', async () => {
    const res = await request(app).post('/api/documents').set('Cookie', managerCookie);
    expect(res.status).not.toBe(403);
  });

  it('blocks viewer from creating invoice', async () => {
    const res = await request(app).post('/api/documents').set('Cookie', viewerCookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });
});
```

### 16.5 Subscription Gate Tests

Test all 3 tiers × each gated feature:

```typescript
const GATED_FEATURES = ['gst', 'customRoles', 'multiGodown', 'pos', 'tallyExport', 'eInvoicing', 'recurring', 'bulkImport'];

for (const feature of GATED_FEATURES) {
  for (const plan of ['FREE', 'PRO', 'BUSINESS'] as const) {
    const shouldAllow = PLAN_LIMITS[plan].features[feature];
    it(`${plan} plan ${shouldAllow ? 'allows' : 'blocks'} ${feature}`, async () => {
      await setBusinessPlan(businessId, plan);
      const res = await request(app).post(`/api/${featureRoute[feature]}`).set('Cookie', cookie);
      if (shouldAllow) {
        expect(res.status).not.toBe(402);
      } else {
        expect(res.status).toBe(402);
        expect(res.body.error).toBe('UPGRADE_REQUIRED');
      }
    });
  }
}
```
