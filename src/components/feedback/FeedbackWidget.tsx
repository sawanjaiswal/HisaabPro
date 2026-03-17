/**
 * Feedback Widget — thin composition layer.
 * Sub-components: FeedbackFab (FAB button), FeedbackModal (form/success/queued).
 * All state lives in useFeedbackWidget hook.
 */

import React from 'react';
import { useFeedbackWidget } from './useFeedbackWidget';
import { FeedbackFab } from './components/FeedbackFab';
import { FeedbackModal } from './components/FeedbackModal';

export const FeedbackWidget: React.FC = () => {
  const {
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
  } = useFeedbackWidget();

  return (
    <div ref={widgetRef} data-feedback-widget>
      <FeedbackFab
        fabPos={fabPos}
        isDraggingFab={isDraggingFab}
        isPulseActive={isPulseActive}
        widgetState={widgetState}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        onPointerCancel={handleFabPointerCancel}
      />

      <FeedbackModal
        widgetState={widgetState}
        screenshotDataUrl={screenshotDataUrl}
        note={note}
        feedbackType={feedbackType}
        onNoteChange={setNote}
        onFeedbackTypeChange={setFeedbackType}
        onSend={sendFeedback}
        onClose={handleClose}
      />
    </div>
  );
};
