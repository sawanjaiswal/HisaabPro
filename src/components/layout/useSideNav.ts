/**
 * SideNav drawer state — open/close wiring, focus, Escape, scroll-lock.
 *
 * Split out of `SideNav.tsx` so that file is markup only. The drawer is opened
 * from anywhere via the OPEN_SIDE_NAV_EVENT (the shared <Header /> hamburger),
 * which is why the open state lives on a window listener rather than a prop.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CALCULATOR_TOGGLE_EVENT, OPEN_SIDE_NAV_EVENT } from '@/config/events.config'

export function useSideNav() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_SIDE_NAV_EVENT, handler)
    return () => window.removeEventListener(OPEN_SIDE_NAV_EVENT, handler)
  }, [])

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Scroll-lock the page behind the drawer; always released on unmount so a
  // route change while open can't leave the body stuck.
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  const handleNavigate = useCallback((route: string) => {
    navigate(route)
    close()
  }, [navigate, close])

  const handleCalculator = useCallback(() => {
    window.dispatchEvent(new Event(CALCULATOR_TOGGLE_EVENT))
    close()
  }, [close])

  return {
    open,
    close,
    closeRef,
    confirmLogout,
    setConfirmLogout,
    handleNavigate,
    handleCalculator,
  }
}
