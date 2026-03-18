/**
 * Business Management Routes
 * Multi-business: create, switch, join, manage
 * All protected with auth + ownerOnly where applicable.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ownerOnly } from '../middleware/team-permission.middleware';
import { asyncHandler } from '../middleware/error-handler.middleware';
import { validate } from '../middleware/validate.middleware';
import { generateTokens } from '../services/auth/auth.service';
import { blacklistToken } from '../services/tokenBlacklist';
import {
  createBusiness,
  switchBusiness,
  listBusinesses,
  joinBusiness,
  updateBusiness,
  regenerateJoinCode,
  listJoinRequests,
  handleJoinRequest,
  BusinessError,
} from '../services/business/business.service';
import {
  createBusinessSchema,
  switchBusinessSchema,
  joinBusinessSchema,
  updateBusinessSchema,
  handleJoinRequestSchema,
} from '../schemas/business.schemas';
import jwt from 'jsonwebtoken';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// ── List businesses ───────────────────────────────────────────────

// GET /api/business — list all owned businesses
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businesses = await listBusinesses(req.user!.userId);
    res.json({ success: true, data: businesses });
  })
);

// ── Create business ───────────────────────────────────────────────

// POST /api/business — create new business (2nd+)
router.post(
  '/',
  ownerOnly,
  validate(createBusinessSchema),
  asyncHandler(async (req, res) => {
    try {
      const { userId, phone, role } = req.user!;
      const { business, dataUserId } = await createBusiness(userId, phone!, role!, req.body);

      // Issue new JWT scoped to the new business
      const tokens = generateTokens(dataUserId, phone!, role ?? 'USER', business.id);

      res.status(201).json({ success: true, data: { business, tokens } });
    } catch (error) {
      if (error instanceof BusinessError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  })
);

// ── Switch business ───────────────────────────────────────────────

// POST /api/business/switch — switch active business, get new JWT
router.post(
  '/switch',
  ownerOnly,
  validate(switchBusinessSchema),
  asyncHandler(async (req, res) => {
    try {
      const { userId, phone, role } = req.user!;
      const { businessId } = req.body as { businessId: string };
      const { dataUserId, businessName } = await switchBusiness(userId, businessId);

      // Blacklist current access token (forces re-auth in new business context)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const accessToken = authHeader.slice(7);
        try {
          const decoded = jwt.decode(accessToken) as { exp?: number } | null;
          const expiresInMs = decoded?.exp ? decoded.exp * 1000 - Date.now() : 72 * 60 * 60 * 1000;
          if (expiresInMs > 0) blacklistToken(accessToken, expiresInMs, userId, 'BUSINESS_SWITCH');
        } catch { /* ignore */ }
      }

      // New tokens: userId = dataUserId of target business, businessId = the business
      const tokens = generateTokens(dataUserId, phone!, role ?? 'USER', businessId);

      res.json({ success: true, data: { tokens, businessId, businessName } });
    } catch (error) {
      if (error instanceof BusinessError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  })
);

// ── Join business ─────────────────────────────────────────────────

// POST /api/business/join — join via 6-char code
router.post(
  '/join',
  validate(joinBusinessSchema),
  asyncHandler(async (req, res) => {
    try {
      const { joinCode } = req.body as { joinCode: string };
      const result = await joinBusiness(req.user!.userId, joinCode);
      res.json({
        success: true,
        message: 'Join request submitted. Waiting for owner approval.',
        data: result,
      });
    } catch (error) {
      if (error instanceof BusinessError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  })
);

// ── Update business ───────────────────────────────────────────────

// PATCH /api/business/:id — update business settings
router.patch(
  '/:id',
  ownerOnly,
  validate(updateBusinessSchema),
  asyncHandler(async (req, res) => {
    try {
      const updated = await updateBusiness(req.user!.userId, req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof BusinessError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  })
);

// POST /api/business/:id/regenerate-code — new join code
router.post(
  '/:id/regenerate-code',
  ownerOnly,
  asyncHandler(async (req, res) => {
    try {
      const joinCode = await regenerateJoinCode(req.user!.userId, req.params.id);
      res.json({ success: true, data: { joinCode } });
    } catch (error) {
      if (error instanceof BusinessError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  })
);

// ── Join request management ───────────────────────────────────────

// GET /api/business/:id/join-requests — list pending join requests
router.get(
  '/:id/join-requests',
  ownerOnly,
  asyncHandler(async (req, res) => {
    try {
      const requests = await listJoinRequests(req.user!.userId, req.params.id);
      res.json({ success: true, data: requests });
    } catch (error) {
      if (error instanceof BusinessError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  })
);

// POST /api/business/:id/join-requests/:requestId — approve or reject
router.post(
  '/:id/join-requests/:requestId',
  ownerOnly,
  validate(handleJoinRequestSchema),
  asyncHandler(async (req, res) => {
    try {
      const { action } = req.body as { action: 'approve' | 'reject' };
      await handleJoinRequest(req.user!.userId, req.params.id, req.params.requestId, action);
      res.json({ success: true, message: `Join request ${action}d` });
    } catch (error) {
      if (error instanceof BusinessError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  })
);

export default router;
