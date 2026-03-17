/**
 * E-Compliance Zod Schemas — E-Invoice (IRP) and E-Way Bill
 */

import { z } from 'zod'

// ─── E-Invoice ───────────────────────────────────────────────────────────────

export const generateEInvoiceSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
}).strict()

export const cancelEInvoiceSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  reason: z.string().min(1, 'Cancel reason is required').max(250),
}).strict()

// ─── E-Way Bill ──────────────────────────────────────────────────────────────

export const TransportModeEnum = z.enum(['ROAD', 'RAIL', 'AIR', 'SHIP'])

export const generateEWayBillSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  transportMode: TransportModeEnum,
  vehicleNumber: z.string().max(20).optional(),
  vehicleType: z.enum(['REGULAR', 'ODC']).optional(),
  transporterId: z.string().max(15).optional(),
  transporterName: z.string().max(100).optional(),
  distance: z.number().int().positive('Distance must be a positive integer (km)'),
  fromPincode: z.string().length(6, 'fromPincode must be exactly 6 digits').regex(/^\d{6}$/),
  toPincode: z.string().length(6, 'toPincode must be exactly 6 digits').regex(/^\d{6}$/),
}).strict()

export const cancelEWayBillSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  reason: z.string().min(1, 'Cancel reason is required').max(250),
}).strict()

export const updatePartBSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  vehicleNumber: z.string().min(1, 'vehicleNumber is required').max(20),
  vehicleType: z.enum(['REGULAR', 'ODC']).optional(),
}).strict()

// ─── Inferred types ──────────────────────────────────────────────────────────

export type GenerateEInvoiceInput = z.infer<typeof generateEInvoiceSchema>
export type CancelEInvoiceInput = z.infer<typeof cancelEInvoiceSchema>
export type GenerateEWayBillInput = z.infer<typeof generateEWayBillSchema>
export type CancelEWayBillInput = z.infer<typeof cancelEWayBillSchema>
export type UpdatePartBInput = z.infer<typeof updatePartBSchema>
