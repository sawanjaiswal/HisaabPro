import type { FeedbackType } from './feedback-widget.types';

export const FAB_SIZE = 40;
export const DRAG_THRESHOLD = 6;
export const EDGE_MARGIN = 8;

export const TYPE_PILLS: { key: FeedbackType; label: string }[] = [
  { key: 'bug', label: 'Bug' },
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'praise', label: 'Praise' },
];
