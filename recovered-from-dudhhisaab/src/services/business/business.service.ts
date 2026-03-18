/**
 * Business Service — Multi-business management (Organizational userId pattern)
 * First business: dataUserId = owner's User.id. Additional: shadow User.id for isolation.
 */

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import type { PermissionPreset } from '@prisma/client';

const MAX_BUSINESSES = 10;
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class BusinessError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

function generateJoinCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes)
    .map((b) => JOIN_CODE_CHARS[b % JOIN_CODE_CHARS.length])
    .join('');
}

/** Auto-create first Business for a new user. Idempotent. Called post-registration. */
export async function createFirstBusiness(userId: string, name: string): Promise<void> {
  const existing = await prisma.business.findFirst({ where: { dataUserId: userId } });
  if (existing) return;

  const business = await prisma.business.create({
    data: { ownerId: userId, dataUserId: userId, name, joinCode: generateJoinCode() },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveBusinessId: business.id },
  });

  logger.info('Business.created_first', { userId, businessId: business.id });
}

/** Create a new additional business. Returns dataUserId for JWT re-issue. */
export async function createBusiness(
  ownerId: string,
  phone: string,
  role: string,
  data: { name: string; type?: string }
): Promise<{ business: { id: string; name: string; joinCode: string }; dataUserId: string }> {
  const count = await prisma.business.count({ where: { ownerId, isActive: true } });
  if (count >= MAX_BUSINESSES) {
    throw new BusinessError('MAX_BUSINESSES', `You can manage up to ${MAX_BUSINESSES} businesses`, 403);
  }

  // Shadow User: internal account for data isolation, no real login
  const shadowPhone = `_shadow_${randomBytes(8).toString('hex')}`;
  const shadowPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const shadowUser = await prisma.user.create({
    data: {
      phone: shadowPhone,
      password: shadowPassword,
      name: data.name,
      isShadowAccount: true,
      isVerified: true,
      role: 'USER',
    },
  });

  await cloneBusinessSettings(ownerId, shadowUser.id);

  const business = await prisma.business.create({
    data: {
      ownerId,
      dataUserId: shadowUser.id,
      name: data.name,
      type: data.type ?? 'dairy',
      joinCode: generateJoinCode(),
      sortOrder: count,
    },
  });

  await prisma.user.update({
    where: { id: ownerId },
    data: { lastActiveBusinessId: business.id },
  });

  logger.info('Business.created', { ownerId, businessId: business.id, dataUserId: shadowUser.id });
  return { business: { id: business.id, name: business.name, joinCode: business.joinCode }, dataUserId: shadowUser.id };
}

/** Switch active business. Returns target dataUserId for token re-issue. */
export async function switchBusiness(
  ownerId: string,
  businessId: string
): Promise<{ dataUserId: string; businessName: string }> {
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerId, isActive: true },
    select: { id: true, dataUserId: true, name: true },
  });

  if (!business) {
    throw new BusinessError('BUSINESS_NOT_FOUND', 'Business not found or access denied', 404);
  }

  await prisma.user.update({
    where: { id: ownerId },
    data: { lastActiveBusinessId: businessId },
  });

  logger.info('Business.switched', { ownerId, businessId, dataUserId: business.dataUserId });
  return { dataUserId: business.dataUserId, businessName: business.name };
}

/** List all active businesses owned by a user */
export async function listBusinesses(ownerId: string) {
  return prisma.business.findMany({
    where: { ownerId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      joinCode: true,
      sortOrder: true,
      createdAt: true,
      dataUserId: true,
    },
  });
}

/** Join a business as staff via 6-char code */
export async function joinBusiness(userId: string, joinCode: string): Promise<{ businessId: string; businessName: string }> {
  const business = await prisma.business.findFirst({
    where: { joinCode, isActive: true },
    select: { id: true, name: true, ownerId: true },
  });

  if (!business) throw new BusinessError('INVALID_CODE', 'Invalid join code', 404);
  if (business.ownerId === userId) throw new BusinessError('OWN_BUSINESS', 'You own this business', 400);

  const existing = await prisma.businessJoinRequest.findUnique({
    where: { businessId_userId: { businessId: business.id, userId } },
    select: { status: true },
  });

  if (existing?.status === 'approved') throw new BusinessError('ALREADY_JOINED', 'Already a member', 400);
  if (existing?.status === 'pending') throw new BusinessError('ALREADY_PENDING', 'Join request pending approval', 400);

  await prisma.businessJoinRequest.upsert({
    where: { businessId_userId: { businessId: business.id, userId } },
    create: { businessId: business.id, userId, status: 'pending' },
    update: { status: 'pending', rejectedAt: null },
  });

  logger.info('Business.join_requested', { userId, businessId: business.id });
  return { businessId: business.id, businessName: business.name };
}

/** Update business metadata */
export async function updateBusiness(ownerId: string, businessId: string, data: { name?: string; type?: string; logoUrl?: string | null }) {
  const business = await prisma.business.findFirst({ where: { id: businessId, ownerId }, select: { dataUserId: true } });
  if (!business) throw new BusinessError('BUSINESS_NOT_FOUND', 'Business not found', 404);

  if (data.name && business.dataUserId !== ownerId) {
    await prisma.user.update({ where: { id: business.dataUserId }, data: { name: data.name } });
  }

  return prisma.business.update({ where: { id: businessId }, data: { ...data } });
}

/** Regenerate join code */
export async function regenerateJoinCode(ownerId: string, businessId: string): Promise<string> {
  const business = await prisma.business.findFirst({ where: { id: businessId, ownerId } });
  if (!business) throw new BusinessError('BUSINESS_NOT_FOUND', 'Business not found', 404);

  const joinCode = generateJoinCode();
  await prisma.business.update({ where: { id: businessId }, data: { joinCode } });
  return joinCode;
}

/** List pending join requests (owner view) */
export async function listJoinRequests(ownerId: string, businessId: string) {
  const business = await prisma.business.findFirst({ where: { id: businessId, ownerId } });
  if (!business) throw new BusinessError('BUSINESS_NOT_FOUND', 'Business not found', 404);

  return prisma.businessJoinRequest.findMany({
    where: { businessId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true, createdAt: true, role: true },
  });
}

/** Approve or reject a join request */
export async function handleJoinRequest(ownerId: string, businessId: string, requestId: string, action: 'approve' | 'reject'): Promise<void> {
  const business = await prisma.business.findFirst({ where: { id: businessId, ownerId } });
  if (!business) throw new BusinessError('BUSINESS_NOT_FOUND', 'Business not found', 404);

  const request = await prisma.businessJoinRequest.findFirst({
    where: { id: requestId, businessId, status: 'pending' },
  });
  if (!request) throw new BusinessError('REQUEST_NOT_FOUND', 'Join request not found', 404);

  await prisma.businessJoinRequest.update({
    where: { id: requestId },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      approvedBy: action === 'approve' ? ownerId : undefined,
      approvedAt: action === 'approve' ? new Date() : undefined,
      rejectedAt: action === 'reject' ? new Date() : undefined,
    },
  });
}

/** Update a staff member's role in a business */
export async function updateStaffRole(ownerId: string, businessId: string, requestId: string, role: PermissionPreset): Promise<void> {
  const business = await prisma.business.findFirst({ where: { id: businessId, ownerId } });
  if (!business) throw new BusinessError('BUSINESS_NOT_FOUND', 'Business not found', 404);

  const request = await prisma.businessJoinRequest.findFirst({ where: { id: requestId, businessId, status: 'approved' } });
  if (!request) throw new BusinessError('MEMBER_NOT_FOUND', 'Staff member not found', 404);

  await prisma.businessJoinRequest.update({ where: { id: requestId }, data: { role } });
}

async function cloneBusinessSettings(fromUserId: string, toUserId: string): Promise<void> {
  const from = await prisma.user.findUnique({
    where: { id: fromUserId },
    select: {
      defaultCowRate: true, defaultBuffaloRate: true,
      acceptsCashPayments: true, acceptsUpiPayments: true,
      notificationLanguage: true, notifyDailySummary: true,
      notifyDeliveryCreated: true, notifyPaymentReceived: true,
      notifyPaymentReminder: true, quietHoursEnabled: true,
      quietHoursStart: true, quietHoursEnd: true,
    },
  });
  if (!from) return;
  await prisma.user.update({ where: { id: toUserId }, data: { ...from } });
}
