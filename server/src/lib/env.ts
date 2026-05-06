/**
 * NIC environment contract validator.
 * Called once at server boot. MB-5 boot-fail: prod creds in non-prod env throws.
 *
 * All NIC vars are optional (stub mode when absent).
 * NIC_ENV only switches sandbox/prod keys — never contains a URL.
 */

import logger from './logger.js'

export type NicEnvKey = 'sandbox' | 'prod'

const VALID_NIC_ENVS: NicEnvKey[] = ['sandbox', 'prod']

/** Called from server entry-point after dotenv loads. */
export function validateNicEnv(): void {
  const nicEnv = process.env.NIC_ENV ?? 'sandbox'
  const nodeEnv = process.env.NODE_ENV ?? 'development'

  if (!VALID_NIC_ENVS.includes(nicEnv as NicEnvKey)) {
    throw new Error(`Invalid NIC_ENV="${nicEnv}". Must be one of: ${VALID_NIC_ENVS.join(', ')}`)
  }

  // MB-5 boot-fail: prod NIC env must only run in production Node
  if (nicEnv === 'prod' && nodeEnv !== 'production') {
    throw new Error(
      `FATAL: NIC_ENV=prod is only allowed when NODE_ENV=production. ` +
      `Current NODE_ENV="${nodeEnv}". This prevents accidental prod NIC calls from dev/staging.`
    )
  }

  const hasCredentials = Boolean(process.env.NIC_IRP_USERNAME)
  if (!hasCredentials) {
    logger.warn('NIC_STUB_MODE_ACTIVE: NIC_IRP_USERNAME not set — e-invoice running in stub mode')
  } else {
    logger.info('NIC_IRP_CONFIGURED', { env: nicEnv })
  }
}

/** Read NIC_ENV safely, defaulting to sandbox. */
export function getNicEnvKey(): NicEnvKey {
  return (process.env.NIC_ENV ?? 'sandbox') as NicEnvKey
}
