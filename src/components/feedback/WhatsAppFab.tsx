/**
 * WhatsAppFab — Draggable WhatsApp support button.
 *
 * - Fixed position, draggable across the screen (pointer capture)
 * - Snaps to left or right edge on release
 * - Constrained within safe zone (below header, above bottom nav)
 * - Tap (no drag) opens WhatsApp with pre-filled message
 * - Position persisted in localStorage
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Z } from '@/config/zIndexes'

const WA_NUMBER = '917000462319'
const WA_MESSAGE = encodeURIComponent(
  'Hi, I need help with HisaabPro. Can you assist me?'
)
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`

const FAB_SIZE = 52
const EDGE_MARGIN = 12
const DRAG_THRESHOLD = 6
const HEADER_HEIGHT = 60  // conservative — matches --header-height
const BOTTOM_NAV_HEIGHT = 80 // bar + safe area


function getInitialPos(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem('wa_fab_pos')
    if (saved) {
      const { x, y } = JSON.parse(saved) as { x: number; y: number }
      return {
        x: Math.min(Math.max(EDGE_MARGIN, x), window.innerWidth - FAB_SIZE - EDGE_MARGIN),
        y: Math.min(Math.max(HEADER_HEIGHT + EDGE_MARGIN, y), window.innerHeight - BOTTOM_NAV_HEIGHT - FAB_SIZE),
      }
    }
  } catch { /* ignore */ }
  // Default: bottom-right, above bottom nav
  return {
    x: window.innerWidth - FAB_SIZE - EDGE_MARGIN,
    y: window.innerHeight - BOTTOM_NAV_HEIGHT - FAB_SIZE - 8,
  }
}

interface DragState {
  startX: number
  startY: number
  originX: number
  originY: number
  didDrag: boolean
}

export const WhatsAppFab: React.FC = () => {
  const [pos, setPos] = useState(getInitialPos)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)

  const snapToEdge = useCallback((x: number, y: number) => {
    const midX = window.innerWidth / 2
    const snappedX =
      x + FAB_SIZE / 2 < midX
        ? EDGE_MARGIN
        : window.innerWidth - FAB_SIZE - EDGE_MARGIN
    const clampedY = Math.min(
      Math.max(HEADER_HEIGHT + EDGE_MARGIN, y),
      window.innerHeight - BOTTOM_NAV_HEIGHT - FAB_SIZE
    )
    const next = { x: snappedX, y: clampedY }
    setPos(next)
    try { localStorage.setItem('wa_fab_pos', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
        didDrag: false,
      }
    },
    [pos]
  )

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.didDrag && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
    drag.didDrag = true
    setIsDragging(true)
    const newX = Math.min(
      Math.max(EDGE_MARGIN, drag.originX + dx),
      window.innerWidth - FAB_SIZE - EDGE_MARGIN
    )
    const newY = Math.min(
      Math.max(HEADER_HEIGHT + EDGE_MARGIN, drag.originY + dy),
      window.innerHeight - BOTTOM_NAV_HEIGHT - FAB_SIZE
    )
    setPos({ x: newX, y: newY })
  }, [])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      const drag = dragRef.current
      dragRef.current = null
      setIsDragging(false)
      if (drag?.didDrag) {
        e.preventDefault()
        snapToEdge(pos.x, pos.y)
      }
      // If not dragged, the native href click will proceed
    },
    [pos, snapToEdge]
  )

  const handlePointerCancel = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  // Keep in bounds on resize
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => ({
        x: Math.min(prev.x, window.innerWidth - FAB_SIZE - EDGE_MARGIN),
        y: Math.min(
          Math.max(HEADER_HEIGHT + EDGE_MARGIN, prev.y),
          window.innerHeight - BOTTOM_NAV_HEIGHT - FAB_SIZE
        ),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <a
      href={WA_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact us on WhatsApp"
      draggable={false}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${FAB_SIZE}px`,
        height: `${FAB_SIZE}px`,
        zIndex: Z.feedbackWidget - 5,
        borderRadius: '50%',
        background: '#25D366',
        boxShadow: '0 4px 16px rgba(37,211,102,0.45), 0 2px 6px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'left 0.22s ease, top 0.22s ease, box-shadow 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
        userSelect: 'none',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          ;(e.currentTarget as HTMLAnchorElement).style.boxShadow =
            '0 6px 20px rgba(37,211,102,0.6), 0 2px 8px rgba(0,0,0,0.22)'
          ;(e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.07)'
        }
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.boxShadow =
          '0 4px 16px rgba(37,211,102,0.45), 0 2px 6px rgba(0,0,0,0.18)'
        ;(e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'
      }}
    >
      {/* WhatsApp SVG — official brand icon */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ display: 'block', pointerEvents: 'none' }}
      >
        <path
          d="M16 2C8.268 2 2 8.268 2 16c0 2.46.665 4.766 1.826 6.754L2 30l7.46-1.797A13.934 13.934 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2Z"
          fill="#fff"
        />
        <path
          d="M16 4.5C9.596 4.5 4.5 9.596 4.5 16c0 2.19.595 4.24 1.635 6.002L4.5 27.5l5.634-1.607A11.46 11.46 0 0 0 16 27.5c6.404 0 11.5-5.096 11.5-11.5S22.404 4.5 16 4.5Zm6.5 15.638c-.27.756-1.59 1.448-2.19 1.538-.568.085-1.284.12-2.073-.13a19.04 19.04 0 0 1-1.876-.694C13.3 19.548 11.2 16.758 11.04 16.545c-.157-.21-1.288-1.712-1.288-3.265 0-1.553.816-2.315 1.105-2.63.29-.316.632-.395.843-.395.211 0 .422.002.607.01.195.008.456-.074.714.545.263.634.895 2.188.974 2.347.079.16.131.344.026.555-.105.21-.158.343-.316.527-.157.184-.33.41-.473.552-.158.157-.322.327-.138.641.184.316.817 1.348 1.754 2.183 1.207 1.077 2.224 1.41 2.54 1.568.316.158.5.131.684-.079.184-.21.79-.921 1.001-1.237.21-.316.42-.263.71-.158.29.105 1.842.868 2.158 1.026.316.158.527.237.605.368.079.131.079.755-.19 1.511Z"
          fill="#25D366"
        />
      </svg>
    </a>
  )
}
