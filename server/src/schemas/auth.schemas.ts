import { z } from 'zod'

const phoneRegex = /^[6-9]\d{9}$/

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  captchaToken: z.string().optional(),
})

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().optional(),
})

export const verifyRegistrationSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
})

export const sendOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
})

export const verifyOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
})

export const resendOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
  context: z.enum(['registration', 'login', 'password_reset']).optional(),
})

export const forgotPasswordSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
  captchaToken: z.string().optional(),
})

export const resetPasswordSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Valid 10-digit Indian mobile number required'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(100),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
})

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
})

export const devLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().optional(),
})

export const switchBusinessSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
})

export const joinBusinessSchema = z.object({
  code: z.string().length(6, 'Invite code must be 6 characters').regex(/^[A-Z0-9]{6}$/, 'Invite code must be alphanumeric uppercase'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyRegistrationInput = z.infer<typeof verifyRegistrationSchema>
export type SendOtpInput = z.infer<typeof sendOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ResendOtpInput = z.infer<typeof resendOtpSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
export type LogoutInput = z.infer<typeof logoutSchema>
export type SwitchBusinessInput = z.infer<typeof switchBusinessSchema>
export type JoinBusinessInput = z.infer<typeof joinBusinessSchema>
