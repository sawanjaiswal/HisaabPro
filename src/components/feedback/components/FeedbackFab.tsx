import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Z } from '../../../config/zIndexes';
import { FAB_SIZE } from '../feedback-widget.constants';
import type { FeedbackFabProps } from '../feedback-widget.types';

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
  <>
    <button
      disabled={widgetState === 'capturing'}
      aria-label="Send feedback"
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
        <span style={{ fontSize: '0.625rem', fontWeight: 600, lineHeight: 1 }}>...</span>
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
  </>
);
