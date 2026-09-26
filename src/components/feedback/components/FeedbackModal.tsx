import { Text } from '@/components/ui/Text'
import React from 'react';
import { X, Send, CheckCircle, WifiOff } from 'lucide-react';
import { Z } from '../../../config/zIndexes';
import { TYPE_PILLS } from '../feedback-widget.constants';
import type { FeedbackModalProps } from '../feedback-widget.types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import '../feedback-widget.css';
import { Heading } from '@/components/ui/Heading'

const SuccessView: React.FC = () => (
  <div className="feedback-result">
    <CheckCircle size={48} className="feedback-result-icon--success" strokeWidth={1.5} />
    <Text className="feedback-result-title">Thanks for your feedback!</Text>
    <Text className="feedback-result-desc">Your feedback helps us improve.</Text>
  </div>
);

const QueuedView: React.FC = () => (
  <div className="feedback-result">
    <WifiOff size={48} className="feedback-result-icon--queued" strokeWidth={1.5} />
    <Text className="feedback-result-title">Saved locally</Text>
    <Text className="feedback-result-desc">Will be sent when you&apos;re back online.</Text>
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
      className="feedback-backdrop"
      style={{ zIndex: Z.fullscreen }}
    >
      <div className="feedback-modal">
        {widgetState === 'success' ? (
          <SuccessView />
        ) : widgetState === 'queued' ? (
          <QueuedView />
        ) : (
          <>
            {/* Header */}
            <div className="feedback-header">
              <Heading level={2}>Send Feedback</Heading>
              <Button variant="none" onClick={onClose} aria-label="Close feedback" className="feedback-close">
                <X size={20} />
              </Button>
            </div>

            {/* Screenshot preview */}
            {screenshotDataUrl && (
              <div className="feedback-screenshot-wrap">
                <img
                  src={screenshotDataUrl}
                  alt="Screenshot"
                  className="feedback-screenshot"
                />
              </div>
            )}

            {/* Type pills */}
            <div className="feedback-pills">
              {TYPE_PILLS.map(({ key, label }) => (
                <Button
                  key={key}
                  variant="none"
                  onClick={() => onFeedbackTypeChange(key)}
                  className={`feedback-pill${feedbackType === key ? ' active' : ''}`}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Note + Send */}
            <div className="feedback-body">
              <Textarea
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
                aria-label="Feedback description"
                className="feedback-textarea"
                disabled={widgetState === 'sending'}
              />
              <Button
                variant="none"
                onClick={onSend}
                disabled={widgetState === 'sending'}
                className="feedback-send"
                aria-label="Send feedback"
              >
                <Send size={16} />
                {widgetState === 'sending' ? 'Sending...' : 'Send Feedback'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
