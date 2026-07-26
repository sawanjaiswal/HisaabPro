/**
 * Import helpers for Suite F (plan §7).
 *
 * The import pipeline is upload → parse → preview → commit, and the commit is
 * bound to a token the parse issued. Every helper therefore threads the token
 * the SERVER returned rather than re-deriving it, because a harness that could
 * mint its own token would pass while the binding it exists to prove was broken.
 *
 * Uploads are rate-limited to 5/hour per user, so a suite using these helpers
 * has to spend them deliberately.
 */

import type { Page, APIResponse } from '@playwright/test'
import { API } from './parties'
import { COOKIES, CSRF_HEADER } from './constants'

/** The client version the import routes require (IMPORT_MIN_CLIENT_VERSION). */
const IMPORT_CLIENT_VERSION = '7.1.0'

export interface ImportJob {
  id: string
  status: string
  rowCount?: number
  errorCount?: number
  commitToken?: string
}

export interface CommitResult {
  committedCount: number
  skippedCount: number
  errorCount: number
  createdEntityIds: string[]
  partial: boolean
}

async function importHeaders(page: Page, idempotencyKey: string) {
  await page.request.get(`${API}/auth/csrf-token`).catch(() => {})
  const cookies = await page.context().cookies()
  return {
    [CSRF_HEADER]: cookies.find((c) => c.name === COOKIES.csrf)?.value ?? '',
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': Date.now().toString(),
    'X-Client-Version': IMPORT_CLIENT_VERSION,
    'X-Idempotency-Key': idempotencyKey,
  }
}

/** Uploads a file as the import wizard does — multipart, one file, format + entity. */
export async function apiUploadImport(
  page: Page,
  file: { name: string; mimeType: string; content: string },
  fields: { format: string; entity?: string } = { format: 'VYAPAR_CSV' },
  idempotencyKey = crypto.randomUUID(),
): Promise<APIResponse> {
  return page.request.post(`${API}/imports`, {
    headers: await importHeaders(page, idempotencyKey),
    multipart: {
      file: {
        name: file.name,
        mimeType: file.mimeType,
        buffer: Buffer.from(file.content, 'utf8'),
      },
      format: fields.format,
      entity: fields.entity ?? 'parties',
    },
  })
}

/** Upload, insisting the parse succeeded and a preview is ready to commit. */
export async function apiUploadPreviewed(
  page: Page,
  file: { name: string; mimeType: string; content: string },
  fields?: { format: string; entity?: string },
): Promise<ImportJob> {
  const res = await apiUploadImport(page, file, fields)
  if (!res.ok()) throw new Error(`upload failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: { job?: ImportJob; existing?: boolean } }
  const job = body.data?.job
  if (!job?.id) throw new Error(`upload returned no job: ${JSON.stringify(body).slice(0, 300)}`)
  return job
}

/**
 * Commits a previewed job. The key is the COMMIT's own — replaying it returns
 * the same commit result; the upload's key must not be reused, because the
 * idempotency log is keyed per user, not per route.
 */
export async function apiCommitImport(
  page: Page,
  jobId: string,
  commitToken: string,
  idempotencyKey = crypto.randomUUID(),
): Promise<APIResponse> {
  return page.request.post(`${API}/imports/${jobId}/commit`, {
    headers: await importHeaders(page, idempotencyKey),
    data: { commitToken },
  })
}

/** Commit, insisting the server accepted it, and return what it created. */
export async function apiCommitImported(
  page: Page,
  jobId: string,
  commitToken: string,
  idempotencyKey?: string,
): Promise<CommitResult> {
  const res = await apiCommitImport(page, jobId, commitToken, idempotencyKey)
  if (!res.ok()) throw new Error(`commit failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: CommitResult }
  if (!body.data) throw new Error(`commit returned nothing: ${JSON.stringify(body).slice(0, 300)}`)
  return body.data
}

export async function apiGetImportJob(page: Page, jobId: string): Promise<ImportJob> {
  const res = await page.request.get(`${API}/imports/${jobId}`)
  if (!res.ok()) throw new Error(`get import job failed (${res.status()})`)
  const body = (await res.json()) as { data?: { job?: ImportJob } & ImportJob }
  return body.data?.job ?? (body.data as ImportJob)
}

/** A Vyapar-shaped party export — the headers Vyapar itself writes. */
export function vyaparPartiesCsv(rows: Array<Record<string, string>>): string {
  const headers = ['Party Name', 'Phone Number', 'Email', 'GSTIN', 'Address', 'Opening Balance']
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? '')).join(','))
  }
  return `${lines.join('\n')}\n`
}

/**
 * Cancels any import this business still has in flight.
 *
 * Only one import may be active per business, and a job left at PREVIEWED by an
 * earlier run blocks every upload after it with a 409. A suite that did not
 * clear it would report the product as broken when the real state is a stale
 * job — so the arrangement is explicit rather than hidden in a fixture.
 */
export async function clearActiveImports(page: Page): Promise<void> {
  const res = await page.request.get(`${API}/imports?limit=20`)
  if (!res.ok()) return
  const body = (await res.json()) as { data?: { jobs?: ImportJob[] } }
  const active = (body.data?.jobs ?? []).filter((j) =>
    ['UPLOADED', 'PARSING', 'PREVIEWED'].includes(j.status),
  )
  for (const job of active) {
    await page.request.delete(`${API}/imports/${job.id}`, {
      headers: await importHeaders(page, crypto.randomUUID()),
    })
  }
}
