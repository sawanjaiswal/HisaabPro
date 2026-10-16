import type { LocalDocument } from '../db/schema';
import type { DocumentSummary } from '../features/invoices/invoice-document.types';
import type { DocumentDetail } from '../features/invoices/invoice.types';

export function mapLocalDocToSummary(d: LocalDocument): DocumentSummary {
  return {
    id: d.id,
    documentNumber: d.documentNumber,
    type: (d.type || 'SALE_INVOICE') as any,
    status: (d.status || 'SAVED') as any,
    documentDate: d.documentDate,
    dueDate: d.dueDate || null,
    party: {
      id: d.partyId,
      name: d.partyName || 'Party',
      phone: '',
    },
    subtotal: d.grandTotal,
    totalDiscount: 0,
    totalAdditionalCharges: 0,
    roundOff: 0,
    grandTotal: d.grandTotal,
    totalProfit: 0,
    paidAmount: d.paidAmount,
    balanceDue: d.balanceAmount,
    lineItemCount: Array.isArray(d.lineItems) ? d.lineItems.length : 0,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function mapLocalDocToDetail(d: LocalDocument): DocumentDetail {
  return {
    id: d.id,
    type: (d.type || 'SALE_INVOICE') as any,
    status: (d.status || 'SAVED') as any,
    documentNumber: d.documentNumber,
    documentDate: d.documentDate,
    dueDate: d.dueDate || null,
    party: {
      id: d.partyId,
      name: d.partyName || 'Customer',
      phone: null,
      outstandingBalance: 0,
    },
    subtotal: d.grandTotal || 0,
    totalDiscount: 0,
    totalAdditionalCharges: 0,
    roundOff: 0,
    grandTotal: d.grandTotal || 0,
    totalProfit: 0,
    paidAmount: d.paidAmount || 0,
    balanceDue: d.balanceAmount || 0,
    lineItemCount: (d.lineItems || []).length,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    paymentTerms: null,
    notes: d.notes || null,
    lineItems: d.lineItems || [],
    additionalCharges: [],
    customFields: [],
    payments: [],
    returns: [],
  } as any;
}

