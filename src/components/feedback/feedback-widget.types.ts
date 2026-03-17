export type WidgetState = 'idle' | 'capturing' | 'form' | 'sending' | 'success' | 'queued';
export type FeedbackType = 'bug' | 'suggestion' | 'praise';

export interface FabPosition {
  x: number;
  y: number;
}

export interface FabDragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  didDrag: boolean;
}

export interface FeedbackFabProps {
  fabPos: FabPosition;
  isDraggingFab: boolean;
  isPulseActive: boolean;
  widgetState: WidgetState;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}

export interface FeedbackModalProps {
  widgetState: WidgetState;
  screenshotDataUrl: string;
  note: string;
  feedbackType: FeedbackType;
  onNoteChange: (value: string) => void;
  onFeedbackTypeChange: (type: FeedbackType) => void;
  onSend: () => void;
  onClose: () => void;
}
