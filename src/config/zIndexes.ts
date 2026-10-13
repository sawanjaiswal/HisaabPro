/**
 * SSOT for z-index stacking layers.
 * Adapted from HisaabPro — removed map-specific layers.
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
  /** Drawers and bottom sheets */
  drawer: 60,
  /** Modals and dialogs */
  modal: 70,
  /** Modal content surface */
  modalContent: 71,
  /** Dropdowns, context menus, select menus (must be above modal) */
  dropdown: 80,
  /** Popovers, date pickers */
  popover: 90,
  /** Tooltips, coachmarks, help overlays */
  tooltip: 100,
  /** Toast notifications, undo ribbon */
  toast: 110,
  /** Feedback widget */
  feedbackWidget: 115,
  /** Full-screen overlays (camera, file picker) */
  fullscreen: 120,
} as const;

export type ZLayer = typeof Z[keyof typeof Z];
