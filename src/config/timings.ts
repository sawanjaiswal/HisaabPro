/**
 * SSOT for UI timing/delay constants (in milliseconds).
 * Adapted from DudhHisaab — removed dairy-specific timings.
 *
 * Usage:
 *   import { TIMINGS } from '../config/timings';
 *   setTimeout(() => navigate(ROUTES.dashboard), TIMINGS.navSuccess);
 */

export const TIMINGS = {
  // -- Navigation delays --
  /** Short transition before programmatic navigation */
  navQuick: 500,
  /** Standard delay after success animation before navigating away */
  navSuccess: 2000,
  /** Extended delay for complex success screens */
  navSlow: 3000,

  // -- UI feedback --
  /** How long to show "Copied!" / clipboard feedback */
  clipboardFeedback: 2000,
  /** Auto-dismiss duration for lightweight dialogs */
  dialogAutoDismiss: 3000,
  /** Toast default duration */
  toastDefault: 4000,
  /** Extended toast for complex errors the user needs time to read */
  toastLong: 15_000,

  // -- Polling & retry --
  /** Wait time before confirming a connection is stable */
  connectionStability: 1000,
  /** Standard retry delay for transient network errors */
  networkRetry: 1500,
  /** Timeout before treating a network request as "too slow" */
  requestTimeout: 5000,

  // -- Session / inactivity --
  /** Show inactivity warning dialog after this idle time */
  sessionWarning: 25 * 60 * 1000,
  /** Auto-logout after this idle time (must be > sessionWarning) */
  sessionLogout: 30 * 60 * 1000,

  // -- Background polling --
  /** Auth inactivity-check interval */
  inactivityCheck: 60_000,
  /** How long before cached offline data is considered stale */
  offlineStaleness: 60_000,
  /** Timeout before resetting a "reconnecting" state back to idle */
  reconnectionTimeout: 10_000,

  // -- API / network --
  /** Default API timeout */
  apiTimeout: 30_000,

  // -- Debounce --
  /** Short debounce for filter/search refresh */
  filterDebounce: 100,
  /** Search input debounce */
  searchDebounce: 300,

  // -- Micro-interactions --
  /** Delay before focusing an input after mount/modal open */
  focusDelay: 100,
  /** Clear transient animation state after CSS transition completes */
  animationClear: 50,
  /** Card swipe / advance-to-next transition duration */
  cardSwipeTransition: 150,
  /** Floating UI element auto-dismiss (bubble, tooltip hover) */
  bubbleDismiss: 400,
  /** Auto-advance delay for wizard steps with no user action needed */
  wizardAutoAdvance: 500,

  // -- Animations --
  /** Duration of pulse/highlight animations */
  pulseAnimation: 3000,

  // -- Toast durations --
  /** Default toast duration */
  toastDefaultDuration: 4_000,
  /** Extended toast for undo actions and important messages */
  toastLongDuration: 10_000,
  /** Undo-capable toast for delete/bulk operations */
  toastUndoDuration: 30_000,

  // -- Polling & background intervals --
  /** Sync queue status check interval */
  syncPollingInterval: 30_000,
  /** Service worker update check interval */
  swUpdateCheckInterval: 60_000,

  // -- UI interactions --
  /** Auto-save draft in forms */
  formAutosaveInterval: 10_000,
  /** Redirect after success screen */
  successRedirectDelay: 3_000,
  /** Chunk preload idle callback timeout */
  preloadIdleTimeout: 5_000,
  /** Feedback screenshot capture timeout */
  feedbackCaptureTimeout: 7_000,
  /** Feedback screenshot capture timeout (large/full-page captures) */
  feedbackCaptureTimeoutLarge: 10_000,
  /** SW update notification auto-dismiss */
  swUpdateNotificationDismiss: 30_000,
} as const;
