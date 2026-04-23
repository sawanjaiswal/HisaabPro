/**
 * Coupon service — public API.
 * Imports from seam files; routes continue to import from coupon.service.js
 * which re-exports from here.
 */

export { createCoupon, bulkCreateCoupons, listCoupons, getCouponDetail, updateCoupon, deactivateCoupon } from './crud.js'

export { validateCoupon, applyCoupon, removeRedemption } from './redemption.js'

export { computeStatus, withStatus, calculateDiscount, COUPON_ERRORS } from './helpers.js'
