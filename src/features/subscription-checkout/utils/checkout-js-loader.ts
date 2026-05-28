/**
 * Lazy <script> loader for Razorpay checkout.js (phone-web surface only).
 *
 * Native Android uses the capacitor-razorpay plugin instead — this script is
 * never injected there. Desktop renders a QR and also never loads it. The
 * promise is memoised so repeated mounts reuse one <script> tag.
 */

import { RAZORPAY_CHECKOUT_SRC } from '../subscription-checkout.constants'

/** Minimal surface of the global Razorpay constructor we rely on. */
export interface RazorpayInstance {
  open: () => void
  close?: () => void
  on?: (event: string, handler: (resp: unknown) => void) => void
}

export interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

let loaderPromise: Promise<RazorpayConstructor> | null = null

export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = RAZORPAY_CHECKOUT_SRC
    script.async = true
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay)
      else reject(new Error('Razorpay checkout.js loaded but global missing'))
    }
    script.onerror = () => {
      loaderPromise = null // allow retry on next attempt
      reject(new Error('Failed to load Razorpay checkout.js'))
    }
    document.head.appendChild(script)
  })

  return loaderPromise
}
