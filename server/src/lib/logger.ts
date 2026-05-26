/**
 * Structured Logging with Winston — adapted from HisaabPro
 */

import winston from 'winston'
import { maskPhone, hashPhone } from './phone-pii.js'

// Keys whose string value will be masked + hashed in every log line.
const PHONE_META_KEYS = new Set([
  'phone', 'phoneNumber', 'mobile', 'mobileNumber',
  'partyPhone', 'recipientPhone', 'fromPhone', 'toPhone',
])

// Loose phone pattern inside free-form messages: 10–15 consecutive digits, optionally
// prefixed by + or whitespace boundary. Masking is conservative — we only rewrite
// matches that look like phones, never arbitrary numeric IDs.
const INLINE_PHONE_RE = /(\+?\d{10,15})/g

function scrubPii(node: unknown, depth = 0): unknown {
  if (depth > 6) return node
  if (node === null || node === undefined) return node
  if (typeof node === 'string') {
    return node.replace(INLINE_PHONE_RE, (m) => maskPhone(m))
  }
  if (Array.isArray(node)) return node.map((v) => scrubPii(v, depth + 1))
  if (typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (PHONE_META_KEYS.has(k) && typeof v === 'string') {
        out[k] = maskPhone(v)
        out[`${k}Hash`] = hashPhone(v)
      } else {
        out[k] = scrubPii(v, depth + 1)
      }
    }
    return out
  }
  return node
}

const piiMaskFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = info.message.replace(INLINE_PHONE_RE, (m) => maskPhone(m))
  }
  for (const k of Object.keys(info)) {
    if (k === 'level' || k === 'message' || k === 'timestamp' || k === 'stack') continue
    info[k] = scrubPii(info[k])
  }
  return info
})()

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  piiMaskFormat,
  winston.format.json()
)

const consoleFormat = winston.format.combine(
  piiMaskFormat,
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`
    }
    return msg
  })
)

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'hisaabpro-api' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    }),
  ],
})

// File transports for production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880,
    maxFiles: 5,
  }))
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880,
    maxFiles: 5,
  }))
}

export default logger
