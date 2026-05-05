/**
 * Job Service — barrel re-export (sibling to document.service.ts)
 * All routes import `* as jobService from '../services/job.service.js'`
 */

export { createJob } from './job/create.js'
export { getJob, listJobs } from './job/get-list.js'
export { updateJob } from './job/update.js'
export { transitionJob } from './job/transition.js'
export { convertJobToInvoice } from './job/convert-to-invoice.js'
export { softDeleteJob } from './job/delete.js'
export { listDeletedJobs, restoreJob, permanentDeleteJob } from './job/recycle.js'
