/**
 * Optimistic lock — contract tests (REAL DB).
 *
 * `version` is the token every client's conflict check reads. If any writer can
 * change a row without advancing it, the next stale save matches and wins — the
 * lost update the lock exists to prevent.
 * See .claude/fix-trace-unversioned-write-lost-update.md.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

async function seedParty() {
  const { user, business } = await seedFullSetup()
  const token = generateToken(user.id, user.phone, business.id)
  const res = await authRequest(app, token)
    .post('/api/parties')
    .send({ name: 'Lock Subject', type: 'CUSTOMER' })
  expect(res.status).toBe(201)
  return { token, business, partyId: res.body.data.party.id as string }
}

describe('PUT /api/parties/:id — optimistic lock', () => {
  it('advances the version even when the writer sends no X-Entity-Version', async () => {
    const { token, partyId } = await seedParty()
    const before = await prisma.party.findUniqueOrThrow({ where: { id: partyId } })

    // The offline queue's replay path, the importers, and any server-to-server
    // caller all write like this.
    const res = await authRequest(app, token)
      .put(`/api/parties/${partyId}`)
      .send({ name: 'Written by an unguarded client' })
    expect(res.status).toBe(200)

    const after = await prisma.party.findUniqueOrThrow({ where: { id: partyId } })
    expect(after.name).toBe('Written by an unguarded client')
    expect(
      after.version,
      'a row that changed must not still claim the version its readers hold',
    ).toBeGreaterThan(before.version)
  })

  it('refuses a save made from a copy an unguarded write has already superseded', async () => {
    const { token, partyId } = await seedParty()
    const { version: heldVersion } = await prisma.party.findUniqueOrThrow({
      where: { id: partyId },
      select: { version: true },
    })

    // Someone else saves — through a client that does not send the header.
    await authRequest(app, token)
      .put(`/api/parties/${partyId}`)
      .send({ name: 'Their change' })
      .expect(200)

    // Our tab still holds the copy from before that write.
    const res = await authRequest(app, token)
      .put(`/api/parties/${partyId}`)
      .set('X-Entity-Version', String(heldVersion))
      .send({ name: 'My change' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(res.body.error.details.serverVersion).toBeGreaterThan(heldVersion)

    const after = await prisma.party.findUniqueOrThrow({ where: { id: partyId } })
    expect(after.name, 'the refused save must not have landed').toBe('Their change')
  })

  it('still accepts a guarded save when nothing has changed underneath', async () => {
    const { token, partyId } = await seedParty()
    const { version } = await prisma.party.findUniqueOrThrow({
      where: { id: partyId },
      select: { version: true },
    })

    const res = await authRequest(app, token)
      .put(`/api/parties/${partyId}`)
      .set('X-Entity-Version', String(version))
      .send({ name: 'Uncontested change' })

    expect(res.status).toBe(200)
    const after = await prisma.party.findUniqueOrThrow({ where: { id: partyId } })
    expect(after.name).toBe('Uncontested change')
    expect(after.version).toBe(version + 1)
  })
})
