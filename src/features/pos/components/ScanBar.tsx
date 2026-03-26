/** POS Scan Bar — Barcode input + camera toggle */

import { useState, useRef } from 'react'
import { Camera, Search, X } from 'lucide-react'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { useLanguage } from '@/hooks/useLanguage'
import { useBarcodeLookup } from '../useBarcodeLookup'

import type { QuickProduct } from '../pos.types'

interface ScanBarProps {
  onProductFound: (product: QuickProduct) => void
}

export function ScanBar({ onProductFound }: ScanBarProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { searching, lookup } = useBarcodeLookup((p) => { onProductFound(p); setQuery('') })

  const handleSubmit = () => { if (query.trim()) lookup(query.trim()) }

  return (
    <>
      <div className="pos-scan-bar" role="search" aria-label={t.search}>
        <div className="pos-scan-input-wrap">
          <Search size={18} className="pos-scan-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="pos-scan-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder={t.scanBarcodeOrSearch}
            aria-label={t.posBarcodeSearch}
            autoComplete="off"
            disabled={searching}
          />
          {query && (
            <button type="button" className="pos-scan-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label={t.posClearSearch}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <button type="button" className="pos-scan-camera-btn" onClick={() => setShowCamera(true)} aria-label={t.posOpenCamera}>
          <Camera size={20} aria-hidden="true" />
        </button>
      </div>
      {showCamera && (
        <BarcodeScanner onScan={(v) => { setShowCamera(false); lookup(v) }} onClose={() => setShowCamera(false)} />
      )}
    </>
  )
}
