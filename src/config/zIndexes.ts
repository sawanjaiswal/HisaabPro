/**
 * SSOT for z-index stacking layers.
 * Adapted from DudhHisaab — removed map-specific layers.
 *
 * Usage:
 *   import { Z } from '../config/zIndexes';
 *   className={`z-[${Z.tooltip}]`}   // Tailwind arbitrary value
 *   style={{ zIndex: Z.modal }}       // Inline style
 */

export const Z = {
  /** In-component UI elements (overlapping badges, notification dots) */
  inComponent: 10,
  /** Sticky section headers inside scrollable lists */
  stickyHeader: 20,
  /** Fixed navigation bars (Header, BottomNav) */
  fixedNav: 30,
  /** Floating action buttons, sticky CTAs */
  floatingAction: 40,
  /** Dropdowns, context menus, date pickers */
  dropdown: 50,
  /** Drawers and bottom sheets */
  drawer: 60,
  /** Modals and dialogs */
  modal: 70,
  /** Tooltips, coachmarks, help overlays */
  tooltip: 80,
  /** Toast notifications, undo ribbon */
  toast: 90,
  /** Feedback widget */
  feedbackWidget: 100,
  /** Full-screen overlays (camera, file picker) */
  fullscreen: 110,
} as const;

export type ZLayer = typeof Z[keyof typeof Z];
