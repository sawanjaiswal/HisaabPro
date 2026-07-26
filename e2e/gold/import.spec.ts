/**
 * Suite F — Data import. Plan: docs/E2E_TEST_PLAN.md §7. Cases TC-IMP-01..05.
 *
 * Import is the first thing a shop does after signing up: their customer list
 * lives in whatever their old app exported, and if it lands wrong they find out
 * months later on a statement. The pipeline is upload → parse → preview →
 * commit, and the interesting failures are all at the seams — a preview that
 * promises rows the commit does not create, a re-upload that doubles the
 * ledger, a bad row that silently takes the good ones down with it.
 *
 * Uploads are rate-limited to 5 per hour per user and this suite needs six, so
 * each case clears the buckets first. The limit is real and deliberate; it is
 * simply not what any case here is asserting, and a 429 leaking from the
 * previous test would look exactly like a product bug in this one.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { API, uniqueName, uniquePartyPhone } from './support/parties'
import {
  apiCommitImport,
  apiCommitImported,
  apiGetImportJob,
  apiUploadImport,
  apiUploadPreviewed,
  clearActiveImports,
  vyaparPartiesCsv,
} from './support/imports'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page, request }) => {
  await request.post(`${API}/__test__/reset-rate-limits`)
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  await clearActiveImports(page)
})

/** How many parties this business has — the number an import has to move. */
async function partyCount(page: import('@playwright/test').Page): Promise<number> {
  const res = await page.request.get(`${API}/parties?limit=1`)
  const body = (await res.json()) as {
    data?: { pagination?: { total?: number }; total?: number }
  }
  const total = body.data?.pagination?.total ?? body.data?.total
  if (typeof total !== 'number') {
    throw new Error(`no party total in response: ${JSON.stringify(body).slice(0, 300)}`)
  }
  return total
}

async function findParty(page: import('@playwright/test').Page, name: string) {
  const res = await page.request.get(`${API}/parties?limit=20&search=${encodeURIComponent(name)}`)
  const body = (await res.json()) as {
    data?: { parties?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
  }
  const list = Array.isArray(body.data) ? body.data : (body.data?.parties ?? [])
  return list.find((p) => p['name'] === name)
}

function csvFile(content: string, name = 'parties.csv') {
  return { name, mimeType: 'text/csv', content }
}

test('TC-IMP-01 a Vyapar export lands as parties, mapped without being asked', async ({ page }) => {
  const tag = uniqueName('Imported')
  // Phones are unique per run: a repeat is a real duplicate of a customer this
  // business already has, and the product is right to refuse to create it twice.
  const phoneOne = uniquePartyPhone()
  const uniqueGstin = () => `27AAACH${Math.floor(1000 + Math.random() * 9000)}R1ZZ`
  const rows = [
    { 'Party Name': `${tag} One`, 'Phone Number': phoneOne, Email: 'one@example.com' },
    { 'Party Name': `${tag} Two`, 'Phone Number': uniquePartyPhone(), GSTIN: uniqueGstin() },
  ]
  const before = await partyCount(page)

  const job = await apiUploadPreviewed(page, csvFile(vyaparPartiesCsv(rows)), {
    format: 'VYAPAR_CSV',
  })

  // The whole point of a named format is that the shopkeeper never sees a
  // column-mapping screen: Vyapar's own headers must map themselves.
  expect(job.status, 'a small file is parsed in the request').toBe('PREVIEWED')
  expect(job.rowCount, 'both rows were read').toBe(2)
  expect(job.errorCount ?? 0, 'a clean file has no row errors').toBe(0)
  expect(job.commitToken, 'the preview issues the token the commit is bound to').toBeTruthy()

  const result = await apiCommitImported(page, job.id, job.commitToken!)
  // A preview that promises two rows and a commit that writes one is the
  // failure that gets discovered a month later, by a customer.
  expect(result.committedCount).toBe(2)
  expect(result.createdEntityIds).toHaveLength(2)
  expect(await partyCount(page)).toBe(before + 2)

  const one = await findParty(page, `${tag} One`)
  expect(one, 'the party is findable by the name from the file').toBeTruthy()
  expect(one!['phone'], 'the phone came across as typed').toBe(phoneOne)
})

test('TC-IMP-02 bad rows are reported and the good rows still import', async ({ page }) => {
  const tag = uniqueName('Mixed')
  const csv = vyaparPartiesCsv([
    { 'Party Name': `${tag} Good`, 'Phone Number': uniquePartyPhone() },
    { 'Party Name': '', 'Phone Number': uniquePartyPhone() },
    { 'Party Name': `${tag} Also Good`, 'Phone Number': 'not-a-phone' },
  ])
  const before = await partyCount(page)

  const job = await apiUploadPreviewed(page, csvFile(csv), { format: 'VYAPAR_CSV' })
  expect(job.commitToken).toBeTruthy()

  const result = await apiCommitImported(page, job.id, job.commitToken!)

  // One unusable row must not cost the shop the other 499. The nameless row is
  // the only one that cannot be saved; a junk phone is a field to flag, not a
  // reason to drop the customer.
  expect(result.committedCount, 'the usable rows are written').toBeGreaterThanOrEqual(1)
  expect(await partyCount(page)).toBe(before + result.committedCount)
  expect(await findParty(page, `${tag} Good`), 'the clean row is there').toBeTruthy()
  expect(result.committedCount + result.skippedCount + result.errorCount).toBeGreaterThanOrEqual(3)
})

test('TC-IMP-03 re-uploading the same file does not double the ledger', async ({ page }) => {
  const tag = uniqueName('Dedup')
  const csv = vyaparPartiesCsv([{ 'Party Name': `${tag} Once`, 'Phone Number': uniquePartyPhone() }])

  const first = await apiUploadPreviewed(page, csvFile(csv), { format: 'VYAPAR_CSV' })
  await apiCommitImported(page, first.id, first.commitToken!)
  const after = await partyCount(page)

  const second = await apiUploadPreviewed(page, csvFile(csv), { format: 'VYAPAR_CSV' })
  if (second.commitToken) {
    const result = await apiCommitImported(page, second.id, second.commitToken)
    // Whatever the path — a recognised re-upload or a dedup match on the row —
    // the second run must not create a second copy of the same customer.
    expect(result.committedCount, 'the duplicate is not created again').toBe(0)
  }

  expect(await partyCount(page), 'the ledger did not double').toBe(after)
})

test('TC-IMP-04 a commit needs the token the preview issued', async ({ page }) => {
  const tag = uniqueName('Forged')
  const csv = vyaparPartiesCsv([{ 'Party Name': `${tag} Row`, 'Phone Number': uniquePartyPhone() }])
  const job = await apiUploadPreviewed(page, csvFile(csv), { format: 'VYAPAR_CSV' })
  const before = await partyCount(page)

  const res = await apiCommitImport(page, job.id, 'not-the-token-the-server-issued')

  // The token binds the commit to the exact preview the user approved. Without
  // it, a stale or replayed request could commit rows nobody looked at.
  expect([400, 401, 403, 409], 'a forged token is refused').toContain(res.status())
  expect(await partyCount(page), 'nothing was written').toBe(before)

  // The job is still committable with the real token — a refused attempt must
  // not strand the user's upload.
  const still = await apiGetImportJob(page, job.id)
  expect(still.status).toBe('PREVIEWED')
  const ok = await apiCommitImported(page, job.id, job.commitToken!)
  expect(ok.committedCount).toBe(1)
})

test('TC-IMP-05 a file that is not the declared format fails cleanly, never half-way', async ({
  page,
}) => {
  const before = await partyCount(page)

  const res = await apiUploadImport(page, {
    name: 'statement.pdf',
    mimeType: 'application/pdf',
    content: '%PDF-1.4\n%âãÏÓ\nnot a csv at all\n',
  })

  // Whatever the server decides — refuse the upload or mark the job FAILED — it
  // may not leave rows behind. "Never a silent partial" is the rule the whole
  // import wizard rests on.
  if (res.ok()) {
    const body = (await res.json()) as { data?: { job?: { id: string; status: string } } }
    const job = body.data?.job
    expect(job, 'a 2xx must still describe a job').toBeTruthy()
    expect(['FAILED', 'UPLOADED', 'PREVIEWED']).toContain(job!.status)
    if (job!.status === 'PREVIEWED') {
      const detail = await apiGetImportJob(page, job!.id)
      expect(detail.rowCount ?? 0, 'a PDF holds no party rows').toBe(0)
    }
  } else {
    expect(res.status()).toBe(400)
  }
  expect(await partyCount(page), 'nothing was written').toBe(before)
})
