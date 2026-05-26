/**
 * GET /api/imports — last 20 import jobs for the current uploader.
 *
 * Uploader-scoped (S5): only the user who uploaded the job sees it on
 * this endpoint. Org-wide visibility flows through the admin audit
 * search UI which reads from AuditLog instead.
 */

import { Router, type Request, type Response } from 'express'
import { auth } from '../../middleware/auth.js'
import { requireActiveBusiness } from '../../middleware/require-active-business.js'
import { requireOwner } from '../../middleware/permission.js'
import { requireFeature } from '../../middleware/require-feature.js'
import { requireMinClientVersion } from '../../middleware/require-min-client-version.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { prisma } from '../../lib/prisma.js'
import { sendSuccess } from '../../lib/response.js'
import { getAuth } from '../../lib/auth-helper.js'
import { IMPORT_MIN_CLIENT_VERSION } from '../../constants/import.constants.js'
import { listImportJobs } from '../../services/import/list.service.js'

export const listImportRoute = Router()

listImportRoute.get(
  '/',
  auth,
  requireActiveBusiness,
  requireOwner(),
  requireFeature('DATA_IMPORT'),
  requireMinClientVersion(IMPORT_MIN_CLIENT_VERSION),
  asyncHandler(async (req: Request, res: Response) => {
    const auth_ = getAuth(req)
    const jobs = await listImportJobs({ auth: auth_, prisma })
    sendSuccess(res, { jobs })
  }),
)
