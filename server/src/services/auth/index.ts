// Auth service — public API surface (re-exports from sub-modules)
export { setTokenCookies, clearTokenCookies } from './tokens.js'
export { devLogin } from './dev-login.js'
export { register, verifyRegistration, resendOtp } from './register.js'
export { login, refreshAccessToken } from './login.js'
export { forgotPassword, resetPassword } from './password-reset.js'
export { sendOtp, verifyOtp } from './otp.js'
export { getMe, switchBusiness, listUserBusinesses } from './me.js'
