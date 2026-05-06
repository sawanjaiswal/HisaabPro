/** Mirror of server EWayBill Prisma model + inputs */

export interface EWayBillRecord {
  id: string
  documentId: string
  ewbNumber: string
  ewbDate: string      // ISO
  validUpto: string    // ISO
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
  transporterId: string | null
  transporterName: string | null
  vehicleNumber: string | null
  vehicleType: 'REGULAR' | 'ODC' | null
  distance: number
  fromPincode: string
  toPincode: string
  status: 'ACTIVE' | 'CANCELLED' | 'EXTENDED'
  cancelReason: string | null
  cancelledAt: string | null
  partBUpdates: PartBEntry[]
  createdAt: string
}

export interface PartBEntry {
  vehicleNumber: string
  vehicleType: 'REGULAR' | 'ODC' | null
  updatedAt: string // ISO
}

export interface GenerateEWBInput {
  documentId: string
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
  transporterId?: string
  transporterName?: string
  vehicleNumber?: string
  vehicleType?: 'REGULAR' | 'ODC'
  distance: number
  fromPincode: string
  toPincode: string
}

export interface UpdatePartBInput {
  documentId: string
  vehicleNumber: string
  vehicleType?: 'REGULAR' | 'ODC'
}

export interface CancelEWBInput {
  documentId: string
  reason: string
}

export const TRANSPORT_MODE_LABELS: Record<string, string> = {
  ROAD: 'Road',
  RAIL: 'Rail',
  AIR: 'Air',
  SHIP: 'Ship',
}

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular',
  ODC: 'Over-Dimensional Cargo',
}
