/** Create Sale Order — thin route entry point; delegates to shared CreateInvoicePage. */
import CreateInvoicePage from '../../invoices/CreateInvoicePage'

export default function CreateSaleOrderPage() {
  return <CreateInvoicePage type="SALE_ORDER" />
}
