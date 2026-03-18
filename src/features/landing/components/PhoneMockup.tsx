/** Phone mockup with mini invoice preview — used in hero section */

const INVOICE_ITEMS = [
  { item: 'Basmati Rice 25kg', qty: 2, amt: '2,400' },
  { item: 'Toor Dal 5kg', qty: 4, amt: '1,120' },
  { item: 'Sunflower Oil 5L', qty: 3, amt: '1,050' },
] as const

export function PhoneMockup() {
  return (
    <div className="phone-mockup relative h-[520px] w-[260px] overflow-hidden rounded-[2.5rem] border-[6px] border-neutral-800 bg-white shadow-2xl shadow-neutral-900/20 dark:border-neutral-600 dark:bg-neutral-900">
      {/* Notch */}
      <div className="absolute inset-x-0 top-0 z-10 mx-auto h-6 w-28 rounded-b-2xl bg-neutral-800 dark:bg-neutral-600" />

      {/* Mini invoice */}
      <div className="flex h-full flex-col p-4 pt-10">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--color-primary-500)]">Invoice #1042</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.625rem] font-semibold text-emerald-700">
            Paid
          </span>
        </div>
        <div className="mb-4 h-px bg-neutral-200 dark:bg-neutral-700" />

        {INVOICE_ITEMS.map((row) => (
          <div key={row.item} className="mb-2.5 flex items-center justify-between text-xs">
            <div>
              <p className="font-medium text-neutral-800 dark:text-neutral-200">{row.item}</p>
              <p className="text-neutral-400">Qty: {row.qty}</p>
            </div>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">Rs {row.amt}</span>
          </div>
        ))}

        <div className="mt-auto rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Total</span>
            <span className="text-base font-bold text-[var(--color-primary-500)]">Rs 4,570</span>
          </div>
        </div>
      </div>
    </div>
  )
}
