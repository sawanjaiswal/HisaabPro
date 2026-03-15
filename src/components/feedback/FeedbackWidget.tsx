/**
 * Feedback Widget — adapted from DudhHisaab (1065 lines → ~350 lines)
 * Simplified: removed annotation tools (will add back when needed),
 * removed feedbackQueue/syncStore deps, uses direct API call + offline fallback.
 *
 * Features:
 * - Draggable FAB that snaps to edges
 * - Screenshot capture via html-to-image
 * - Feedback type selection (Bug, Suggestion, Praise)
 * - Note textarea with Enter-to-send
 * - Success/sending states
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle, WifiOff } from 'lucide-react';
import { Z } from '../../config/zIndexes';
import { TIMINGS } from '../../config/timings';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

type WidgetState = 'idle' | 'capturing' | 'form' | 'sending' | 'success' | 'queued';
type FeedbackType = 'bug' | 'suggestion' | 'praise';

const FAB_SIZE = 48;
const DRAG_THRESHOLD = 6;
const EDGE_MARGIN = 8;

export const FeedbackWidget: React.FC = () => {
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [note, setNote] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [isPulseActive, setIsPulseActive] = useState(true);
  const isOnline = useOnlineStatus();
  const widgetRef = useRef<HTMLDivElement>(null);

  // -- FAB drag state --
  const getInitialFabPos = (): { x: number; y: number } => {
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
    return { x: window.innerWidth - FAB_SIZE - 16, y: window.innerHeight - 80 - FAB_SIZE };
  };

  const [fabPos, setFabPos] = useState(getInitialFabPos);
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const fabDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; didDrag: boolean } | null>(null);

  const snapToEdge = useCallback((x: number, y: number) => {
    const midX = window.innerWidth / 2;
    const snappedX = x + FAB_SIZE / 2 < midX ? EDGE_MARGIN : window.innerWidth - FAB_SIZE - EDGE_MARGIN;
    const clampedY = Math.min(Math.max(EDGE_MARGIN, y), window.innerHeight - FAB_SIZE - EDGE_MARGIN);
    const pos = { x: snappedX, y: clampedY };
    setFabPos(pos);
    localStorage.setItem('feedback_fab_pos', JSON.stringify(pos));
  }, []);

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
  }, [fabPos, snapToEdge]);

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

  const captureScreenshot = useCallback(async () => {
    setWidgetState('capturing');
    if (widgetRef.current) widgetRef.current.style.display = 'none';
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let dataUrl = '';

    try {
      // Dynamic import to avoid bundling html-to-image if unused
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

    // Fallback: grid placeholder
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
      // TODO: Queue to IndexedDB when offline sync is built
      setWidgetState('queued');
      setTimeout(() => { setWidgetState('idle'); resetWidget(); }, TIMINGS.navSuccess);
      return;
    }

    try {
      const token = sessionStorage.getItem('access_token');
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const typePills: { key: FeedbackType; label: string }[] = [
    { key: 'bug', label: 'Bug' },
    { key: 'suggestion', label: 'Suggestion' },
    { key: 'praise', label: 'Praise' },
  ];

  return (
    <div ref={widgetRef} data-feedback-widget>
      {/* FAB */}
      <button
        disabled={widgetState === 'capturing'}
        aria-label="Send feedback"
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        onPointerCancel={() => { fabDragRef.current = null; setIsDraggingFab(false); }}
        style={{
          position: 'fixed',
          left: `${fabPos.x}px`,
          top: `${fabPos.y}px`,
          width: `${FAB_SIZE}px`,
          height: `${FAB_SIZE}px`,
          borderRadius: '50%',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          border: 'none',
          cursor: widgetState === 'capturing' ? 'wait' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: Z.feedbackWidget,
          opacity: widgetState === 'capturing' ? 1 : 0.75,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          transition: isDraggingFab ? 'none' : 'left 0.25s ease, top 0.25s ease, opacity 0.2s ease',
          animation: isPulseActive ? 'feedbackPulse 1.5s ease-in-out 2' : 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {widgetState === 'capturing' ? (
          <span style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1 }}>...</span>
        ) : (
          <MessageSquarePlus size={20} strokeWidth={1.8} />
        )}
      </button>

      <style>{`
        @keyframes feedbackPulse {
          0%   { box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 0 0 0 rgba(26,26,26,0.5); }
          50%  { box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 0 0 10px rgba(26,26,26,0); }
          100% { box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 0 0 0 rgba(26,26,26,0); }
        }
      `}</style>

      {/* Feedback Modal */}
      {(widgetState === 'form' || widgetState === 'sending' || widgetState === 'success' || widgetState === 'queued') && (
        <div
          data-feedback-widget
          style={{
            position: 'fixed', inset: 0, zIndex: Z.fullscreen,
            display: 'flex', flexDirection: 'column',
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          {/* Content card */}
          <div
            style={{
              margin: 'auto 16px', maxWidth: '480px', width: '100%',
              alignSelf: 'center',
              backgroundColor: '#fff', borderRadius: '16px',
              overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            {widgetState === 'success' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px' }}>
                <CheckCircle size={48} color="#22c55e" strokeWidth={1.5} />
                <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Thanks for your feedback!</p>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, textAlign: 'center' }}>Your feedback helps us improve.</p>
              </div>
            ) : widgetState === 'queued' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px' }}>
                <WifiOff size={48} color="#f59e0b" strokeWidth={1.5} />
                <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Saved locally</p>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, textAlign: 'center' }}>Will be sent when you're back online.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Send Feedback</h3>
                  <button onClick={handleClose} aria-label="Close feedback" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: '#94a3b8' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Screenshot preview */}
                {screenshotDataUrl && (
                  <div style={{ padding: '12px 20px 0' }}>
                    <img
                      src={screenshotDataUrl}
                      alt="Screenshot"
                      style={{ width: '100%', height: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', maxHeight: '200px', objectFit: 'cover' }}
                    />
                  </div>
                )}

                {/* Type pills */}
                <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 8px' }}>
                  {typePills.map(({ key, label }) => {
                    const isActive = feedbackType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setFeedbackType(key)}
                        style={{
                          padding: '6px 16px', borderRadius: '999px',
                          border: isActive ? 'none' : '1px solid #e2e8f0',
                          backgroundColor: isActive ? '#111' : 'transparent',
                          color: isActive ? '#fff' : '#475569',
                          fontSize: '13px', fontWeight: isActive ? 600 : 400,
                          cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Note + Send */}
                <div style={{ padding: '8px 20px 20px' }}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (widgetState !== 'sending') sendFeedback();
                      }
                    }}
                    placeholder="Describe the issue... (Enter to send)"
                    rows={3}
                    style={{
                      width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px',
                      padding: '10px 14px', fontSize: '14px', outline: 'none',
                      fontFamily: 'inherit', color: '#111', backgroundColor: '#f8fafc',
                      resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box',
                    }}
                    disabled={widgetState === 'sending'}
                  />
                  <button
                    onClick={sendFeedback}
                    disabled={widgetState === 'sending'}
                    style={{
                      width: '100%', marginTop: '12px', padding: '12px',
                      borderRadius: '10px', border: 'none',
                      backgroundColor: widgetState === 'sending' ? '#94a3b8' : '#111',
                      color: '#fff', fontSize: '14px', fontWeight: 600,
                      cursor: widgetState === 'sending' ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                    aria-label="Send feedback"
                  >
                    <Send size={16} />
                    {widgetState === 'sending' ? 'Sending...' : 'Send Feedback'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
