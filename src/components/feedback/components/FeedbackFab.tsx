import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Z } from '../../../config/zIndexes';
import { FAB_SIZE } from '../feedback-widget.constants';
import type { FeedbackFabProps } from '../feedback-widget.types';
import '../feedback-widget.css';

export const FeedbackFab: React.FC<FeedbackFabProps> = ({
  fabPos,
  isDraggingFab,
  isPulseActive,
  widgetState,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) => (
  <button
    disabled={widgetState === 'capturing'}
    aria-label="Send feedback"
    className="feedback-fab"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    style={{
      position: 'fixed',
      left: `${fabPos.x}px`,
      top: `${fabPos.y}px`,
      width: `${FAB_SIZE}px`,
      height: `${FAB_SIZE}px`,
      zIndex: Z.feedbackWidget,
      opacity: widgetState === 'capturing' ? 1 : 0.75,
      cursor: widgetState === 'capturing' ? 'wait' : 'grab',
      transition: isDraggingFab ? 'none' : 'left 0.25s ease, top 0.25s ease, opacity 0.2s ease',
      animation: isPulseActive ? 'feedbackPulse 1.5s ease-in-out 2' : 'none',
    }}
  >
    {widgetState === 'capturing' ? (
      <span style={{ fontSize: '0.625rem', fontWeight: 600, lineHeight: 1 }}>...</span>
    ) : (
      <MessageSquarePlus size={20} strokeWidth={1.8} />
    )}
  </button>
);
