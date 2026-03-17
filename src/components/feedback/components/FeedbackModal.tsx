import React from 'react';
import { X, Send, CheckCircle, WifiOff } from 'lucide-react';
import { Z } from '../../../config/zIndexes';
import { TYPE_PILLS } from '../feedback-widget.constants';
import type { FeedbackModalProps } from '../feedback-widget.types';

const SuccessView: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px' }}>
    <CheckCircle size={48} color="#22c55e" strokeWidth={1.5} />
    <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Thanks for your feedback!</p>
    <p style={{ fontSize: '13px', color: '#64748b', margin: 0, textAlign: 'center' }}>Your feedback helps us improve.</p>
  </div>
);

const QueuedView: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px' }}>
    <WifiOff size={48} color="#f59e0b" strokeWidth={1.5} />
    <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Saved locally</p>
    <p style={{ fontSize: '13px', color: '#64748b', margin: 0, textAlign: 'center' }}>Will be sent when you&apos;re back online.</p>
  </div>
);

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  widgetState,
  screenshotDataUrl,
  note,
  feedbackType,
  onNoteChange,
  onFeedbackTypeChange,
  onSend,
  onClose,
}) => {
  const isVisible = widgetState === 'form' || widgetState === 'sending' || widgetState === 'success' || widgetState === 'queued';
  if (!isVisible) return null;

  return (
    <div
      data-feedback-widget
      style={{
        position: 'fixed', inset: 0, zIndex: Z.fullscreen,
        display: 'flex', flexDirection: 'column',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div
        style={{
          margin: 'auto 16px', maxWidth: '480px', width: '100%',
          alignSelf: 'center',
          backgroundColor: '#fff', borderRadius: '16px',
          overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        {widgetState === 'success' ? (
          <SuccessView />
        ) : widgetState === 'queued' ? (
          <QueuedView />
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Send Feedback</h3>
              <button onClick={onClose} aria-label="Close feedback" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: '#94a3b8' }}>
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
              {TYPE_PILLS.map(({ key, label }) => {
                const isActive = feedbackType === key;
                return (
                  <button
                    key={key}
                    onClick={() => onFeedbackTypeChange(key)}
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
                onChange={(e) => onNoteChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (widgetState !== 'sending') onSend();
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
                onClick={onSend}
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
  );
};
