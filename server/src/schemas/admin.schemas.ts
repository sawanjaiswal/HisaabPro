/**
 * Admin Panel — Zod Validation Schemas
 * All admin endpoint request bodies are validated here.
 */

import { z } from 'zod'

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
}).strict()

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
}).strict()

// --------------------------------------------------------------------------
// User management
// --------------------------------------------------------------------------

export const suspendUserSchema = z.object({
  reason: z.string().min(5, 'Suspension reason must be at least 5 characters').max(500),
  notes: z.string().max(500).optional(),
}).strict()

export const unsuspendUserSchema = z.object({
  notes: z.string().max(500).optional(),
}).strict()

export const listUsersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  status: z.enum(['all', 'active', 'inactive', 'suspended']).default('all'),
}).strict()

// --------------------------------------------------------------------------
// Business management
// --------------------------------------------------------------------------

export const listBusinessesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
}).strict()

// --------------------------------------------------------------------------
// Dashboard
// --------------------------------------------------------------------------

export const dashboardPeriodQuerySchema = z.object({
  period: z.enum(['7', '30', '90']).default('30'),
}).strict()

// --------------------------------------------------------------------------
// Settings
// --------------------------------------------------------------------------

export const updatePlatformSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(1000),
}).strict()

// --------------------------------------------------------------------------
// Type exports
// --------------------------------------------------------------------------

export type AdminLoginRequest = z.infer<typeof adminLoginSchema>
export type SuspendUserRequest = z.infer<typeof suspendUserSchema>
export type UnsuspendUserRequest = z.infer<typeof unsuspendUserSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type ListBusinessesQuery = z.infer<typeof listBusinessesQuerySchema>
export type DashboardPeriodQuery = z.infer<typeof dashboardPeriodQuerySchema>
export type UpdatePlatformSettingRequest = z.infer<typeof updatePlatformSettingSchema>
