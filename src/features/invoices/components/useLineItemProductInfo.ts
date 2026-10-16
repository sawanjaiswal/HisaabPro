import { useState, useEffect } from 'react'
import { db } from '@/db/schema'
import { PREDEFINED_UNITS } from '@/features/products/product.constants'
import { getProduct } from '@/features/products/product.service'

export interface ProductMeta {
  sku?: string | null
  unitSymbol: string
  currentStock: number | null
  purchasePrice: number | null
}

export function useLineItemProductInfo(productId: string): ProductMeta {
  const [meta, setMeta] = useState<ProductMeta>({
    unitSymbol: 'PCS',
    currentStock: null,
    purchasePrice: null,
  })

  useEffect(() => {
    if (!productId) return
    let active = true

    // 0ms local read from Dexie
    db.products.get(productId).then((local) => {
      if (!active) return
      if (local) {
        const matchedUnit = PREDEFINED_UNITS.find((u) => u.id === local.unitId)
        setMeta({
          sku: local.sku,
          unitSymbol: matchedUnit ? matchedUnit.symbol.toUpperCase() : 'PCS',
          currentStock: local.currentStock ?? 0,
          purchasePrice: local.purchasePrice ?? null,
        })
      } else {
        // Fallback to SWR server fetch if local record is missing
        getProduct(productId)
          .then((d) => {
            if (!active) return
            setMeta({
              sku: d.sku,
              unitSymbol: d.unit?.symbol ? d.unit.symbol.toUpperCase() : 'PCS',
              currentStock: d.currentStock ?? 0,
              purchasePrice: d.purchasePrice ?? null,
            })
          })
          .catch(() => {})
      }
    }).catch(() => {})

    return () => {
      active = false
    }
  }, [productId])

  return meta
}
