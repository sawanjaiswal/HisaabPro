/** Create Estimate — thin route entry point; delegates to shared CreateInvoicePage. */
import CreateInvoicePage from '../../invoices/CreateInvoicePage'

export default function CreateEstimatePage() {
  return <CreateInvoicePage type="ESTIMATE" />
}
