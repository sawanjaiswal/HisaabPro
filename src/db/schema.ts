import Dexie, { Table } from 'dexie';

export interface LocalParty {
  id: string;
  businessId: string;
  name: string;
  phone?: string | null;
  type: string;
  companyName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  outstandingBalance: number; // in paise
  isActive: boolean;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalProduct {
  id: string;
  businessId: string;
  name: string;
  sku?: string | null;
  unitId: string;
  currentStock: number;
  salePrice: number; // in paise
  purchasePrice?: number | null; // in paise
  minStockLevel: number;
  isActive: boolean;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalDocument {
  id: string;
  businessId: string;
  documentNumber: string;
  type: string;
  status: string;
  partyId: string;
  partyName?: string;
  documentDate: string;
  dueDate?: string | null;
  grandTotal: number; // in paise
  paidAmount: number; // in paise
  balanceAmount: number; // in paise
  lineItems?: any[];
  notes?: string | null;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalPayment {
  id: string;
  businessId: string;
  paymentNumber?: string;
  type: string;
  partyId: string;
  partyName?: string;
  amount: number; // in paise
  mode: string;
  date: string;
  referenceNumber?: string | null;
  notes?: string | null;
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  businessId: string;
  idempotencyKey: string;
  entityType: 'PARTY' | 'PRODUCT' | 'DOCUMENT' | 'PAYMENT';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  baseVersion: number;
  payload: any;
  hlcTimestamp: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  attempts: number;
  lastError?: string | null;
  createdAt: string;
}

export interface SyncMeta {
  id: string;
  businessId: string;
  lastSyncTimestamp?: string | null;
  lastSyncStatus?: 'IDLE' | 'SYNCING' | 'ERROR' | 'SUCCESS';
  deviceId: string;
  schemaVersion: number;
  updatedAt: string;
}

export class HisaabDatabase extends Dexie {
  parties!: Table<LocalParty, string>;
  products!: Table<LocalProduct, string>;
  documents!: Table<LocalDocument, string>;
  payments!: Table<LocalPayment, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('HisaabPro_LocalDB_v1');

    this.version(1).stores({
      parties: 'id, businessId, name, phone, type, outstandingBalance, isActive, isDeleted, updatedAt',
      products: 'id, businessId, name, sku, unitId, currentStock, isActive, isDeleted, updatedAt',
      documents: 'id, businessId, documentNumber, type, status, partyId, documentDate, isDeleted, updatedAt',
      payments: 'id, businessId, type, partyId, amount, mode, date, isDeleted, updatedAt',
      syncQueue: 'id, businessId, idempotencyKey, entityType, entityId, operation, status, hlcTimestamp, createdAt',
      syncMeta: 'id, businessId, lastSyncTimestamp, schemaVersion',
    });
  }
}

export const db = new HisaabDatabase();
