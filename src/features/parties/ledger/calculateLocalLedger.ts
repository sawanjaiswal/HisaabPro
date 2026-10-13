/**
 * Pure Local Ledger Calculator (Offline-First SSOT)
 *
 * Computes deterministic customer/supplier ledger statements entirely in JavaScript
 * from Dexie LocalDocument and LocalPayment records using integer paise arithmetic.
 */

import { db } from '@/db/schema';
import type { LedgerParams, LedgerResponse, LedgerRow, LedgerVoucherType } from './ledger.types';

export async function calculateLocalLedger(
  partyId: string,
  params: LedgerParams
): Promise<LedgerResponse> {
  const party = await db.parties.get(partyId);
  const partyName = party?.name || 'Party';

  // 1. Fetch all documents and payments for this party
  const [docs, payments] = await Promise.all([
    db.documents.where('partyId').equals(partyId).toArray(),
    db.payments.where('partyId').equals(partyId).toArray(),
  ]);

  // Only posted documents affect the ledger
  const POSTED_STATUSES = new Set(['SAVED', 'SHARED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']);
  const activeDocs = docs.filter((d) => !d.isDeleted && POSTED_STATUSES.has(d.status));
  const activePayments = payments.filter((p) => !p.isDeleted);

  // 2. Synthesize ledger row candidates
  type Candidate = {
    id: string;
    date: string;
    createdAt: string;
    source: 'DOCUMENT' | 'PAYMENT' | 'JOURNAL';
    voucherType: LedgerVoucherType;
    particulars: string;
    voucherNumber: string;
    dr: number;
    cr: number;
    itemCount?: number;
    mode?: string;
  };

  const candidates: Candidate[] = [];

  for (const doc of activeDocs) {
    // Non-financial documents do not alter accounting ledgers
    if (doc.type === 'ESTIMATE' || doc.type === 'PROFORMA' || doc.type === 'DELIVERY_CHALLAN') {
      continue;
    }

    const isSale = doc.type === 'SALE_INVOICE';
    const isSaleReturn = doc.type === 'CREDIT_NOTE' || doc.type === 'SALE_RETURN';
    const isPurchase = doc.type === 'PURCHASE_INVOICE';
    const isPurchaseReturn = doc.type === 'DEBIT_NOTE' || doc.type === 'PURCHASE_RETURN';

    let dr = 0;
    let cr = 0;
    let vType: LedgerVoucherType = 'SALE';

    if (isSale) {
      dr = doc.grandTotal;
      vType = 'SALE';
    } else if (isSaleReturn) {
      cr = doc.grandTotal;
      vType = 'CREDIT_NOTE';
    } else if (isPurchase) {
      cr = doc.grandTotal;
      vType = 'PURCHASE';
    } else if (isPurchaseReturn) {
      dr = doc.grandTotal;
      vType = 'DEBIT_NOTE';
    }

    candidates.push({
      id: doc.id,
      date: (doc.documentDate || doc.createdAt).slice(0, 10),
      createdAt: doc.createdAt || '',
      source: 'DOCUMENT',
      voucherType: vType,
      particulars: `${doc.type.replace(/_/g, ' ')} #${doc.documentNumber}`,
      voucherNumber: doc.documentNumber,
      dr,
      cr,
      itemCount: doc.lineItems?.length || 0,
    });
  }

  for (const pay of activePayments) {
    const isReceipt = pay.type === 'PAYMENT_IN';
    candidates.push({
      id: pay.id,
      date: (pay.date || pay.createdAt).slice(0, 10),
      createdAt: pay.createdAt || '',
      source: 'PAYMENT',
      voucherType: isReceipt ? 'RECEIPT' : 'PAYMENT',
      particulars: `Payment via ${pay.mode || 'CASH'}${pay.referenceNumber ? ` (${pay.referenceNumber})` : ''}`,
      voucherNumber: pay.paymentNumber || pay.referenceNumber || 'PAY',
      dr: isReceipt ? 0 : pay.amount,
      cr: isReceipt ? pay.amount : 0,
      mode: pay.mode,
    });
  }

  // 3. Sort chronologically ascending with deterministic createdAt tiebreak
  candidates.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  // 4. Calculate running balance and filter by date range
  let running = party?.outstandingBalance ? 0 : 0;
  let openingBalance = 0;
  let closingBalance = 0;
  const filteredRows: LedgerRow[] = [];

  for (const item of candidates) {
    const netDelta = item.dr - item.cr;
    if (item.date < params.from) {
      openingBalance += netDelta;
      running += netDelta;
      closingBalance = running;
      continue;
    }

    if (item.date <= params.to) {
      running += netDelta;
      closingBalance = running;
      if (!params.voucherTypes || params.voucherTypes.length === 0 || params.voucherTypes.includes(item.voucherType)) {
        filteredRows.push({
          id: item.id,
          source: item.source,
          date: item.date,
          voucherType: item.voucherType,
          particulars: item.particulars,
          voucherNumber: item.voucherNumber,
          dr: item.dr,
          cr: item.cr,
          runningBalance: running,
          itemCount: item.itemCount,
          mode: item.mode,
        });
      }
    }
  }

  return {
    partyId,
    partyName,
    fromDate: params.from,
    toDate: params.to,
    openingBalance,
    closingBalance,
    rows: filteredRows.reverse(), // Reverse to display newest on top
    nextCursor: null,
    totalCount: filteredRows.length,
  };
}
