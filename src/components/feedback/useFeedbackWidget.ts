import { useState, useRef, useEffect, useCallback } from 'react';
import { TIMINGS } from '../../config/timings';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { FAB_SIZE, EDGE_MARGIN, DRAG_THRESHOLD } from './feedback-widget.constants';
import type { WidgetState, FeedbackType, FabPosition, FabDragState } from './feedback-widget.types';

function getInitialFabPos(): FabPosition {
  try {
    const saved = localStorage.getItem('feedback_fab_pos');
    if (saved) {
      const { x, y } = JSON.parse(saved);
      return {
        x: Math.min(Math.max(EDGE_MARGIN, x), window.innerWidth - FAB_SIZE - EDGE_MARGIN),
        y: Math.min(Math.max(EDGE_MARGIN, y), window.innerHeight - FAB_SIZE - EDGE_MARGIN),
      };
    }
  } catch { /* ignore */ }
  // Anchor above the bottom nav (64 + safe-area chin) so the FAB sits in the
  // safe zone rather than over scrollable content.
  const BOTTOM_NAV_CLEARANCE = 88;
  return {
    x: window.innerWidth - FAB_SIZE - 12,
    y: window.innerHeight - BOTTOM_NAV_CLEARANCE - FAB_SIZE,
  };
}

export function useFeedbackWidget() {
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [note, setNote] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [isPulseActive, setIsPulseActive] = useState(true);
  const isOnline = useOnlineStatus();
  const widgetRef = useRef<HTMLDivElement>(null);

  // -- FAB drag state --
  const [fabPos, setFabPos] = useState(getInitialFabPos);
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const fabDragRef = useRef<FabDragState | null>(null);

  const snapToEdge = useCallback((x: number, y: number) => {
    const midX = window.innerWidth / 2;
    const snappedX = x + FAB_SIZE / 2 < midX ? EDGE_MARGIN : window.innerWidth - FAB_SIZE - EDGE_MARGIN;
    const clampedY = Math.min(Math.max(EDGE_MARGIN, y), window.innerHeight - FAB_SIZE - EDGE_MARGIN);
    const pos = { x: snappedX, y: clampedY };
    setFabPos(pos);
    localStorage.setItem('feedback_fab_pos', JSON.stringify(pos));
  }, []);

  const captureScreenshot = useCallback(async () => {
    setWidgetState('capturing');
    if (widgetRef.current) widgetRef.current.style.display = 'none';
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let dataUrl = '';

    try {
      const { toCanvas } = await import('html-to-image');
      const capturePromise = toCanvas(document.documentElement, {
        width: vw,
        height: vh,
        pixelRatio: 1,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',
        skipAutoScale: true,
        filter: (node: HTMLElement) => node?.getAttribute?.('data-feedback-widget') == null,
      });
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMINGS.feedbackCaptureTimeout));
      const canvas = await Promise.race([capturePromise, timeout]);

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const result = canvas.toDataURL('image/png', 0.8);
        if (result && result.length > 200) dataUrl = result;
      }
    } catch { /* html-to-image failed */ }

    if (widgetRef.current) widgetRef.current.style.display = '';

    // Fallback: placeholder
    if (!dataUrl) {
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, vw, vh);
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Screenshot unavailable', vw / 2, vh / 2 - 10);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Describe the issue below', vw / 2, vh / 2 + 15);
        dataUrl = canvas.toDataURL('image/png');
      }
    }

    setScreenshotDataUrl(dataUrl);
    setWidgetState('form');
  }, []);

  const resetWidget = useCallback(() => {
    setNote('');
    setScreenshotDataUrl('');
    setFeedbackType('bug');
  }, []);

  const sendFeedback = useCallback(async () => {
    setWidgetState('sending');

    const payload = {
      type: feedbackType === 'praise' ? 'general' : feedbackType === 'suggestion' ? 'feature' : 'bug',
      message: note.trim() || `[${feedbackType}] Feedback from widget`,
      screenshot: screenshotDataUrl,
      metadata: {
        route: window.location.pathname,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    };

    if (!isOnline) {
      import('../../lib/offline').then(({ enqueue }) => {
        enqueue({
          method: 'POST',
          path: '/feedback',
          body: JSON.stringify(payload),
          createdAt: Date.now(),
          status: 'pending',
          retryCount: 0,
          errorMessage: null,
          entityType: 'feedback',
          entityLabel: `Feedback: ${feedbackType}`,
        });
      }).catch(() => { /* enqueue failed */ });
      setWidgetState('queued');
      setTimeout(() => { setWidgetState('idle'); resetWidget(); }, TIMINGS.navSuccess);
      return;
    }

    try {
      const { API_URL } = await import('../../config/app.config');
      await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setWidgetState('success');
      setTimeout(() => { setWidgetState('idle'); resetWidget(); }, TIMINGS.navSuccess);
    } catch {
      setWidgetState('queued');
      setTimeout(() => { setWidgetState('idle'); resetWidget(); }, TIMINGS.navSuccess);
    }
  }, [note, feedbackType, screenshotDataUrl, isOnline, resetWidget]);

  const handleClose = useCallback(() => {
    setWidgetState('idle');
    resetWidget();
  }, [resetWidget]);

  // -- FAB pointer handlers --
  const handleFabPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fabDragRef.current = { startX: e.clientX, startY: e.clientY, originX: fabPos.x, originY: fabPos.y, didDrag: false };
  }, [fabPos]);

  const handleFabPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.didDrag && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    drag.didDrag = true;
    setIsDraggingFab(true);
    const newX = Math.min(Math.max(EDGE_MARGIN, drag.originX + dx), window.innerWidth - FAB_SIZE - EDGE_MARGIN);
    const newY = Math.min(Math.max(EDGE_MARGIN, drag.originY + dy), window.innerHeight - FAB_SIZE - EDGE_MARGIN);
    setFabPos({ x: newX, y: newY });
  }, []);

  const handleFabPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current;
    fabDragRef.current = null;
    setIsDraggingFab(false);
    if (drag?.didDrag) {
      e.preventDefault();
      snapToEdge(fabPos.x, fabPos.y);
    } else {
      captureScreenshot();
    }
  }, [fabPos, snapToEdge, captureScreenshot]);

  const handleFabPointerCancel = useCallback(() => {
    fabDragRef.current = null;
    setIsDraggingFab(false);
  }, []);

  // Keep FAB in viewport on resize
  useEffect(() => {
    const onResize = () => {
      setFabPos((prev) => ({
        x: Math.min(prev.x, window.innerWidth - FAB_SIZE - EDGE_MARGIN),
        y: Math.min(prev.y, window.innerHeight - FAB_SIZE - EDGE_MARGIN),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsPulseActive(false), TIMINGS.pulseAnimation);
    return () => clearTimeout(timer);
  }, []);

  return {
    widgetRef,
    widgetState,
    screenshotDataUrl,
    note,
    setNote,
    feedbackType,
    setFeedbackType,
    fabPos,
    isDraggingFab,
    isPulseActive,
    handleFabPointerDown,
    handleFabPointerMove,
    handleFabPointerUp,
    handleFabPointerCancel,
    sendFeedback,
    handleClose,
  };
}
