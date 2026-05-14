/**
 * Authenticated document share-link CRUD routes — PR3 #130.
 *
 * Mount: server/src/routes/documents/index.ts
 *   router.use('/', shareLinksRouter)
 *
 * Endpoints:
 *   POST   /api/documents/:documentId/share-links   — issue new link
 *   GET    /api/documents/:documentId/share-links   — list non-revoked links
 *   PATCH  /api/documents/:documentId/share-links/:linkId — revoke
 *
 * Security:
 *   - All routes require auth (via documents/index.ts middleware).
 *   - Every query scopes by businessId from req.user (IDOR guard).
 *   - tokenHash is never returned (shared-link.service strips it).
 *   - Token plaintext returned ONCE on issue; never readable again.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { prisma } from '../lib/prisma.js'
import {
  issueSharedLink,
  revokeSharedLink,
  listSharedLinks,
} from '../services/shared-link.service.js'
import {
  issueShareLinkBodySchema,
  revokeShareLinkBodySchema,
} from '../validators/document-share-link.validators.js'

const ALLOWED_STATUSES = new Set(['SAVED', 'SHARED', 'PAID', 'PARTIALLY_PAID'])

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://hisaabpro.in'

const router = Router()

// ---------------------------------------------------------------------------
// POST /api/documents/:documentId/share-links — issue a new share link
// ---------------------------------------------------------------------------

router.post(
  '/:documentId/share-links',
  validate(issueShareLinkBodySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const issuedById = req.user!.userId
    const documentId = String(req.params.documentId)
    const { ttlDays } = req.body as { ttlDays?: 7 | 30 | 90 | null }

    // Validate document belongs to this business and has an allowed status
    const doc = await prisma.document.findFirst({
      where: { id: documentId, businessId, isDeleted: false },
      select: { id: true, status: true, documentNumber: true },
    })

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
      })
      return
    }

    if (!ALLOWED_STATUSES.has(doc.status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DOCUMENT_STATUS',
          message: `Cannot share a document with status ${doc.status}. Allowed: SAVED, SHARED, PAID, PARTIALLY_PAID`,
        },
      })
      return
    }

    const { link, token } = await issueSharedLink({
      resourceType: 'INVOICE',
      resourceId: documentId,
      businessId,
      issuedById,
      ttlDays: ttlDays ?? undefined,
      metadata: { documentNumber: doc.documentNumber },
    })

    const url = `/p/invoice/${token}`
    const shareUrl = `${APP_BASE_URL}${url}`

    res.status(201).json({
      success: true,
      data: {
        id: link.id,
        token,       // plaintext — returned ONCE; unrecoverable after this response
        url,
        shareUrl,
        expiresAt: link.expiresAt ?? null,
        accessCount: link.accessCount,
        createdAt: link.createdAt,
      },
    })
  })
)

// ---------------------------------------------------------------------------
// GET /api/documents/:documentId/share-links — list links for this document
// tokenHash is never returned (service strips it)
// ---------------------------------------------------------------------------

router.get(
  '/:documentId/share-links',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.documentId)

    // Confirm document belongs to this business
    const doc = await prisma.document.findFirst({
      where: { id: documentId, businessId, isDeleted: false },
      select: { id: true },
    })

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
      })
      return
    }

    const links = await listSharedLinks({
      resourceType: 'INVOICE',
      resourceId: documentId,
      businessId,
    })

    res.status(200).json({ success: true, data: links })
  })
)

// ---------------------------------------------------------------------------
// PATCH /api/documents/:documentId/share-links/:linkId — revoke a link
// ---------------------------------------------------------------------------

router.patch(
  '/:documentId/share-links/:linkId',
  validate(revokeShareLinkBodySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.documentId)
    const linkId = String(req.params.linkId)

    // Confirm document belongs to this business
    const doc = await prisma.document.findFirst({
      where: { id: documentId, businessId, isDeleted: false },
      select: { id: true },
    })

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
      })
      return
    }

    // Confirm link belongs to this business+document before revoking
    const existing = await prisma.sharedLink.findFirst({
      where: {
        id: linkId,
        businessId,
        resourceId: documentId,
        resourceType: 'INVOICE',
      },
      select: { id: true, revokedAt: true },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'LINK_NOT_FOUND', message: 'Share link not found' },
      })
      return
    }

    if (existing.revokedAt != null) {
      res.status(409).json({
        success: false,
        error: { code: 'LINK_ALREADY_REVOKED', message: 'This link has already been revoked' },
      })
      return
    }

    const revoked = await revokeSharedLink({ id: linkId, businessId })

    res.status(200).json({ success: true, data: revoked })
  })
)

export default router
