/**
 * /api/imports — barrel router for Phase 7 slice 7.1A.
 *
 * Mount order matters: error-csv MUST be registered BEFORE the generic
 * `:id` get route, otherwise `/imports/:id/error-csv` is captured by the
 * `:id` matcher (Express matches in declaration order even when the
 * generic GET has a different verb — the path tree is shared).
 */

import { Router } from 'express'
import { createImportRoute } from './create.route.js'
import { commitImportRoute } from './commit.route.js'
import { cancelImportRoute } from './cancel.route.js'
import { errorCsvImportRoute } from './error-csv.route.js'
import { getImportRoute } from './get.route.js'
import { listImportRoute } from './list.route.js'

const importsRouter = Router()

importsRouter.use(listImportRoute)
importsRouter.use(createImportRoute)
importsRouter.use(commitImportRoute)
importsRouter.use(cancelImportRoute)
importsRouter.use(errorCsvImportRoute)
importsRouter.use(getImportRoute)

export default importsRouter
