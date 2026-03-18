/** Competitor Data Import — Constants */

import type { ImportSourceConfig, ImportDataType } from './data-import.types'

export const IMPORT_SOURCES: ImportSourceConfig[] = [
  {
    id: 'VYAPAR',
    name: 'Vyapar',
    description: 'Import from Vyapar Excel export',
    acceptedFormats: '.xlsx,.xls,.csv',
    dataTypes: ['PARTIES', 'PRODUCTS', 'INVOICES'],
  },
  {
    id: 'TALLY',
    name: 'Tally',
    description: 'Import from Tally Prime XML or Excel',
    acceptedFormats: '.xml,.xlsx,.xls,.csv',
    dataTypes: ['PARTIES', 'PRODUCTS', 'INVOICES'],
  },
  {
    id: 'BUSY',
    name: 'Busy',
    description: 'Import from Busy Accounting exports',
    acceptedFormats: '.xlsx,.xls,.csv',
    dataTypes: ['PARTIES', 'PRODUCTS'],
  },
  {
    id: 'MARG',
    name: 'Marg',
    description: 'Import from Marg ERP exports',
    acceptedFormats: '.xlsx,.xls,.csv',
    dataTypes: ['PARTIES', 'PRODUCTS'],
  },
  {
    id: 'EXCEL',
    name: 'Excel / CSV',
    description: 'Import from any Excel or CSV file with manual column mapping',
    acceptedFormats: '.xlsx,.xls,.csv',
    dataTypes: ['PARTIES', 'PRODUCTS', 'INVOICES'],
  },
]

export const DATA_TYPE_LABELS: Record<ImportDataType, string> = {
  PARTIES: 'Parties',
  PRODUCTS: 'Products',
  INVOICES: 'Invoices',
}

/** Known column name → target field mappings for auto-detection */
export const KNOWN_COLUMN_MAPS: Record<string, Record<string, string>> = {
  PARTIES: {
    'name': 'name', 'party name': 'name', 'customer name': 'name', 'supplier name': 'name',
    'phone': 'phone', 'mobile': 'phone', 'phone number': 'phone', 'contact': 'phone',
    'email': 'email', 'email id': 'email', 'e-mail': 'email',
    'type': 'type', 'party type': 'type',
    'gstin': 'gstin', 'gst no': 'gstin', 'gst number': 'gstin',
    'address': 'address', 'city': 'city', 'state': 'state', 'pincode': 'pincode',
    'opening balance': 'openingBalance', 'balance': 'openingBalance',
  },
  PRODUCTS: {
    'name': 'name', 'item name': 'name', 'product name': 'name', 'description': 'name',
    'hsn': 'hsn', 'hsn code': 'hsn', 'hsn/sac': 'hsn',
    'unit': 'unit', 'uom': 'unit',
    'rate': 'rate', 'price': 'rate', 'selling price': 'rate', 'sale price': 'rate', 'mrp': 'rate',
    'purchase price': 'purchasePrice', 'cost': 'purchasePrice', 'cost price': 'purchasePrice',
    'stock': 'stock', 'quantity': 'stock', 'opening stock': 'stock',
    'barcode': 'barcode',
  },
  INVOICES: {
    'invoice no': 'invoiceNumber', 'invoice number': 'invoiceNumber', 'bill no': 'invoiceNumber',
    'date': 'date', 'invoice date': 'date', 'bill date': 'date',
    'party': 'partyName', 'customer': 'partyName', 'party name': 'partyName',
    'amount': 'amount', 'total': 'amount', 'grand total': 'amount', 'net amount': 'amount',
  },
}

export const MAX_IMPORT_ROWS = 500
export const MAX_FILE_SIZE_MB = 10
