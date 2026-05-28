/**
 * Picks the checkout surface for the current device.
 *
 *   android-native — Capacitor native Android → capacitor-razorpay plugin
 *                    (the ONLY surface where UPI Intent works; checkout.js
 *                    disables UPI inside any WebView via its `; wv)` UA check)
 *   phone-web      — mobile browser (coarse pointer, ≤768px) → checkout.js widget
 *   desktop-web    — everything else → QR code the user scans with a UPI app
 */

import { useMemo } from 'react'
import { Capacitor } from '@capacitor/core'
import type { CheckoutSurface } from '../subscription-checkout.types'

export function detectSurface(): CheckoutSurface {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return 'android-native'
  }
  const isPhone =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
  return isPhone ? 'phone-web' : 'desktop-web'
}

export function useCheckoutDevice(): CheckoutSurface {
  return useMemo(() => detectSurface(), [])
}
