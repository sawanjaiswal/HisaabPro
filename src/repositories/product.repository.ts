import { HisaabDatabase, LocalProduct, db as defaultDb } from '../db/schema';
import { OutboxEngine } from '../sync/OutboxEngine';
import { liveQueryBus } from '../domain/live-query-bus';
import { SyncManager } from '../sync/SyncManager';
import type { ProductListResponse, ProductFilters, ProductFormData } from '../features/products/product.types';
import type { ProductSummary } from '@/lib/types/product.types';

export class ProductRepository {
  constructor(
    private db: HisaabDatabase = defaultDb,
    private businessId: string = 'default'
  ) {}

  /**
   * 0ms Local-First Read: List products instantly from Dexie
   */
  async list(filters: Partial<ProductFilters> = {}): Promise<ProductListResponse> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const search = (filters.search || '').trim().toLowerCase();
    const lowStockOnly = filters.lowStockOnly;

    let items = await this.db.products
      .where('businessId')
      .equals(this.businessId)
      .toArray();

    items = items.filter((p) => !p.isDeleted);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockValue = 0;

    for (const p of items) {
      if (p.currentStock <= p.minStockLevel) {
        lowStockCount++;
      }
      if (p.currentStock <= 0) {
        outOfStockCount++;
      }
      if (p.purchasePrice && p.currentStock > 0) {
        totalStockValue += p.currentStock * p.purchasePrice;
      }
    }

    if (lowStockOnly) {
      items = items.filter((p) => p.currentStock <= p.minStockLevel);
    }

    if (search) {
      items = items.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(search) ||
          (p.sku || '').toLowerCase().includes(search)
      );
    }

    items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedItems = items.slice(startIndex, startIndex + limit);

    const products: ProductSummary[] = pagedItems.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      category: null,
      unit: { id: p.unitId || 'default_unit', name: 'Units', symbol: 'PCS' },
      currentStock: p.currentStock,
      salePrice: p.salePrice,
      purchasePrice: p.purchasePrice ?? null,
      minStockLevel: p.minStockLevel,
      status: p.isActive ? 'ACTIVE' : 'INACTIVE',
      createdAt: p.createdAt,
    }));

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary: {
        totalProducts: total,
        lowStockCount,
        totalStockValue,
        outOfStockCount,
      },
    };
  }

  /**
   * 0ms Local-First Read: Get a single product by ID
   */
  async getById(id: string): Promise<LocalProduct | null> {
    const p = await this.db.products.get(id);
    if (!p || p.businessId !== this.businessId || p.isDeleted) return null;
    return p;
  }

  /**
   * <1ms Optimistic Write: Create product locally + enqueue outbox
   */
  async create(data: ProductFormData): Promise<LocalProduct> {
    const nowIso = new Date().toISOString();
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `temp_prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newProd: LocalProduct = {
      id: tempId,
      businessId: this.businessId,
      name: data.name,
      sku: data.sku || null,
      unitId: data.unitId || 'default_unit',
      salePrice: data.salePrice || 0,
      purchasePrice: data.purchasePrice || null,
      currentStock: data.openingStock || 0,
      minStockLevel: data.minStockLevel || 0,
      isActive: true,
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.products, this.db.syncQueue], async () => {
      await this.db.products.put(newProd);
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'PRODUCT',
        entityId: tempId,
        operation: 'CREATE',
        payload: {
          ...data,
          id: tempId,
        },
        baseVersion: 0,
      });
    });

    liveQueryBus.invalidate(['products']);
    SyncManager.triggerSync();

    return newProd;
  }

  /**
   * <1ms Optimistic Delete: Soft-delete product locally + enqueue outbox
   */
  async delete(id: string): Promise<void> {
    const existing = await this.db.products.get(id);
    if (!existing || existing.businessId !== this.businessId) return;

    const nowIso = new Date().toISOString();
    const updated: LocalProduct = {
      ...existing,
      isDeleted: true,
      version: existing.version + 1,
      updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.products, this.db.syncQueue], async () => {
      await this.db.products.put(updated);
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'PRODUCT',
        entityId: id,
        operation: 'DELETE',
        payload: { id },
        baseVersion: existing.version,
      });
    });

    liveQueryBus.invalidate(['products']);
    liveQueryBus.invalidate(['products', id]);
    SyncManager.triggerSync();
  }
}
