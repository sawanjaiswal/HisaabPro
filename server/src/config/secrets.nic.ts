/**
 * NIC IRP credentials — opaque reader.
 * Only einvoice.token-store.ts and einvoice.nic-client.ts may import this.
 * NIC_IRP_PASSWORD is NEVER logged — treat as a credential.
 */

import { EINVOICE_ERRORS } from '../services/einvoice/einvoice.errors.js'

interface NicIrpCreds {
  username: string
  password: string
  clientId?: string
  clientSecret?: string
}

class NicNotConfiguredError extends Error {
  code = EINVOICE_ERRORS.NIC_NOT_CONFIGURED
  constructor() {
    super('NIC IRP credentials are not configured (NIC_IRP_USERNAME / NIC_IRP_PASSWORD)')
    this.name = 'NicNotConfiguredError'
  }
}

/**
 * Read NIC credentials from environment.
 * Throws NicNotConfiguredError (code: NIC_NOT_CONFIGURED) when missing.
 * Caller is expected to catch and short-circuit into stub mode.
 */
export function getNicIrpCreds(): NicIrpCreds {
  const username = process.env.NIC_IRP_USERNAME
  const password = process.env.NIC_IRP_PASSWORD
  if (!username || !password) throw new NicNotConfiguredError()
  return {
    username,
    password,
    clientId: process.env.NIC_CLIENT_ID,
    clientSecret: process.env.NIC_CLIENT_SECRET,
  }
}

export { NicNotConfiguredError }
