import { z } from 'zod'

const phoneRegex = /^[6-9]\d{9}$/

export const sendOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
})

export const verifyOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
})

export const devLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type SendOtpInput = z.infer<typeof sendOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
export type LogoutInput = z.infer<typeof logoutSchema>
