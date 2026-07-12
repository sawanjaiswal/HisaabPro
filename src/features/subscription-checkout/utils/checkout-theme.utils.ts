/**
 * Resolves the Razorpay widget's backdrop color to match this app's own
 * `--backdrop-color` design token (tokens-core.css / tokens-dark.css),
 * since Razorpay's checkout.js/native SDK render outside this app's CSS
 * cascade and otherwise default to their own opaque black overlay.
 */
export function getRazorpayBackdropColor(): string {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(26, 25, 23, 0.5)'
}
