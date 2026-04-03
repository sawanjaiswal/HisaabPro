/**
 * SSE (Server-Sent Events) endpoint — real-time sync for multi-user.
 * GET /api/events/stream — auth required, per-business event stream.
 */

import { Router } from 'express'
import type { Response } from 'express'
import { auth } from '../middleware/auth.js'
import { subscribe, unsubscribe, getClientCount } from '../services/sse.service.js'

const router = Router()

// SSE stream — authenticated, per-business
router.get('/stream', auth, (req, res) => {
  const businessId = req.user!.businessId
  const userId = req.user!.userId

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  })

  // Tag connection with userId for sender exclusion
  ;(res as Response & { _sseUserId?: string })._sseUserId = userId

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`)

  subscribe(businessId, res)

  // Heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
    }
  }, 30_000)

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe(businessId, res)
  })
})

// SSE connection stats (for monitoring/health)
router.get('/stats', auth, (_req, res) => {
  res.json({ success: true, data: { clients: getClientCount() } })
})

export default router
