/** Create Delivery Challan — thin route entry point; delegates to shared CreateInvoicePage. */
import CreateInvoicePage from '../../invoices/CreateInvoicePage'

export default function CreateChallanPage() {
  return <CreateInvoicePage type="DELIVERY_CHALLAN" />
}
