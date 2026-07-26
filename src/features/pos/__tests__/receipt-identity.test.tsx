/**
 * The POS receipt must be issued by the shop that made the sale.
 *
 * Both receipt surfaces carried `const MOCK_BUSINESS = { name: 'My Business',
 * gstEnabled: false }`, so every printed slip named a placeholder and claimed
 * GST was off regardless of the shop's registration. The e2e suite cannot see
 * this — the receipt renders as a PDF inside an iframe, where no selector
 * reaches the text — so the identity is proved here, at the boundary where the
 * business details enter the document.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'

const gstGate = { gstEnabled: true, gstin: '27AAACH7409R1ZZ' }
const activeBusiness = { id: 'b1', name: 'E2E Traders' }

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeBusiness }) }))
vi.mock('@/features/gst/useGstGate', () => ({ useGstGate: () => gstGate }))
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: {} }) }))

// The PDF renderer needs a browser canvas; the test only cares which props the
// document was built with, so the viewer is replaced by its own children.
vi.mock('@react-pdf/renderer', () => ({
  PDFViewer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PDFDownloadLink: () => null,
}))
vi.mock('../components/receipt/ReceiptShareBar', () => ({ ReceiptShareBar: () => null }))

const docProps: Array<Record<string, unknown>> = []
const spyDoc = (props: Record<string, unknown>) => {
  docProps.push(props)
  return <div data-testid="receipt-doc">{String(props.businessName)}</div>
}
vi.mock('../components/receipt/Receipt58mm', () => ({ Receipt58mm: (p: Record<string, unknown>) => spyDoc(p) }))
vi.mock('../components/receipt/Receipt80mm', () => ({ Receipt80mm: (p: Record<string, unknown>) => spyDoc(p) }))
vi.mock('../components/receipt/ReceiptA5', () => ({ ReceiptA5: (p: Record<string, unknown>) => spyDoc(p) }))

const { usePosBusinessInfo } = await import('../hooks/usePosBusinessInfo')
const { ReceiptPreview } = await import('../components/receipt/ReceiptPreview')

describe('POS receipt identity', () => {
  it('takes the shop name and GST details from the session, not a literal', () => {
    const { result } = renderHook(() => usePosBusinessInfo())

    expect(result.current.name).toBe('E2E Traders')
    expect(result.current.name).not.toBe('My Business')
    expect(result.current.gstin).toBe('27AAACH7409R1ZZ')
    expect(result.current.gstEnabled).toBe(true)
  })

  it('prints the sale under that shop', () => {
    docProps.length = 0
    const sale = {
      id: 's1',
      receiptNumber: 'POS-2627-00001',
      grandTotal: 25000,
      items: [],
      paymentBreakdown: [],
    }

    render(
      <ReceiptPreview
        sale={sale as never}
        businessInfo={{ name: 'E2E Traders', gstin: '27AAACH7409R1ZZ', gstEnabled: true }}
      />,
    )

    expect(docProps.at(-1)?.businessName).toBe('E2E Traders')
    expect(docProps.at(-1)?.gstEnabled).toBe(true)
    expect(screen.getByTestId('receipt-doc')).toHaveTextContent('E2E Traders')
  })
})
