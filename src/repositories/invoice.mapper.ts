import type { LocalDocument } from '../db/schema';
import type { DocumentSummary } from '../features/invoices/invoice-document.types';

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
