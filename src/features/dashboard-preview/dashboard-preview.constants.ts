import { ROUTES } from '@/config/routes.config'
import type { QuickDockAction } from './dashboard-preview.types'

export const PREVIEW_QUICK_ACTIONS: QuickDockAction[] = [
  {
    id: 'new_sale',
    label: 'New Sale',
    route: `${ROUTES.INVOICE_CREATE}?type=SALE`,
    iconName: 'plus',
    highlight: true,
  },
  {
    id: 'record_payment',
    label: 'Record In',
    route: `${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`,
    iconName: 'arrow-down-left',
  },
  {
    id: 'bill_scan',
    label: 'Scan Bill',
    route: ROUTES.BILL_SCAN,
    iconName: 'scan',
  },
  {
    id: 'add_party',
    label: 'Add Party',
    route: ROUTES.PARTY_NEW,
    iconName: 'user-plus',
  },
]
