/**
 * Build NIC EWB JSON envelope from document + business + party + transport details.
 * Amounts in paise (NIC expects rupees — convert /100).
 */

interface DocumentSummary {
  id: string
  documentNumber: string | null
  documentDate: Date
  grandTotal: number        // paise
  totalTaxableValue: number // paise
  totalCgst: number         // paise
  totalSgst: number         // paise
  totalIgst: number         // paise
  totalCess: number         // paise
  placeOfSupply: string | null
}

interface BusinessInfo {
  gstin: string | null
  name: string
  address: string | null
  stateCode: string | null  // 2-digit GSTIN state code (NOT pincode prefix)
}

interface PartyInfo {
  gstin: string | null
  name: string
  stateCode: string | null  // 2-digit GSTIN state code
}

export interface TransporterDetails {
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
  transporterId?: string | null
  transporterName?: string | null
  distance: number
}

export interface VehicleDetails {
  vehicleNumber?: string | null
  vehicleType?: 'REGULAR' | 'ODC' | null
  fromPincode: string
  toPincode: string
}

export interface EwbEnvelopeInput {
  document: DocumentSummary
  business: BusinessInfo
  party: PartyInfo
  transporterDetails: TransporterDetails
  vehicleDetails: VehicleDetails
}

/** Map transport mode string to NIC code */
const TRANSPORT_MODE_MAP: Record<string, string> = {
  ROAD: '1',
  RAIL: '2',
  AIR: '3',
  SHIP: '4',
}

/** Paise → rupees (NIC expects rupees as integers) */
function toRupees(paise: number): number {
  return Math.round(paise / 100)
}

export function buildEwbEnvelope(input: EwbEnvelopeInput): Record<string, unknown> {
  const { document: doc, business, party, transporterDetails: trans, vehicleDetails: veh } = input

  const docDate = doc.documentDate
    .toISOString()
    .slice(0, 10)
    .split('-')
    .reverse()
    .join('/')

  return {
    supplyType: 'O',       // Outward
    subSupplyType: '1',    // Supply
    docType: 'INV',
    docNo: doc.documentNumber ?? doc.id,
    docDate,
    fromGstin: business.gstin ?? '',
    fromTrdName: business.name,
    fromStateCode: Number(business.stateCode ?? '0'),
    toGstin: party.gstin ?? 'URP', // URP = Unregistered Party
    toTrdName: party.name,
    toStateCode: Number(party.stateCode ?? '0'),
    totalValue: toRupees(doc.grandTotal),
    cgstValue: toRupees(doc.totalCgst),
    sgstValue: toRupees(doc.totalSgst),
    igstValue: toRupees(doc.totalIgst),
    cessValue: toRupees(doc.totalCess),
    cessNonAdvolValue: 0,
    totInvValue: toRupees(doc.grandTotal),
    transMode: TRANSPORT_MODE_MAP[trans.transportMode] ?? '1',
    transDistance: trans.distance,
    transporterId: trans.transporterId ?? '',
    transporterName: trans.transporterName ?? '',
    transDocNo: '',
    transDocDate: '',
    vehicleNo: veh.vehicleNumber ?? '',
    vehicleType: veh.vehicleType ?? 'REGULAR',
    fromPincode: Number(veh.fromPincode),
    toPincode: Number(veh.toPincode),
    // F-21: pincode prefix ≠ GSTIN state code (e.g. Delhi=11 pincode, 07 state).
    // Use the business/party stateCode from GSTIN, fallback to fromStateCode already set above.
    actFromStateCode: Number(business.stateCode ?? business.gstin?.slice(0, 2) ?? '0'),
    actToStateCode: Number(party.stateCode ?? party.gstin?.slice(0, 2) ?? '0'),
  }
}
