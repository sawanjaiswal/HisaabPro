/**
 * Business Schemas — Zod validation for multi-business endpoints
 */

import { z } from 'zod';

const BUSINESS_TYPES = ['dairy', 'farm', 'shop', 'other'] as const;

export const createBusinessSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').trim(),
  type: z.enum(BUSINESS_TYPES).optional().default('dairy'),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  type: z.enum(BUSINESS_TYPES).optional(),
  logoUrl: z.string().max(100_000, 'Logo too large').nullable().optional(),
});

export const switchBusinessSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
});

export const joinBusinessSchema = z.object({
  joinCode: z
    .string()
    .length(6, 'Join code must be exactly 6 characters')
    .regex(/^[A-Z0-9]+$/i, 'Join code must be alphanumeric')
    .transform((v) => v.toUpperCase()),
});

export const handleJoinRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
});
