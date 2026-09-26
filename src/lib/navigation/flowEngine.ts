/**
 * Level 6 Navigation & Flow Engine
 * Single Source of Truth for Back Actions, Task Frames, and History Reconciler.
 */

type DismissHandler = () => boolean | void
type DirtyCheckHandler = () => boolean

class FlowOverlayManager {
  private overlayStack: DismissHandler[] = []
  private dirtyCheckers: Set<DirtyCheckHandler> = new Set()

  /**
   * Register an open overlay (TaskFrame, Modal, BottomSheet, Drawer).
   * Returns an unregister cleanup function.
   */
  public registerOverlay(dismiss: DismissHandler): () => void {
    this.overlayStack.push(dismiss)
    return () => {
      this.overlayStack = this.overlayStack.filter((fn) => fn !== dismiss)
    }
  }

  /**
   * Register a dirty form guard for the active route.
   */
  public registerDirtyGuard(checkDirty: DirtyCheckHandler): () => void {
    this.dirtyCheckers.add(checkDirty)
    return () => {
      this.dirtyCheckers.delete(checkDirty)
    }
  }

  /**
   * Handles top-level back event.
   * Returns true if the event was consumed by an active overlay/frame.
   */
  public handleOverlayBack(): boolean {
    if (this.overlayStack.length > 0) {
      const topDismiss = this.overlayStack.pop()
      if (topDismiss) {
        topDismiss()
        return true
      }
    }
    return false
  }

  /**
   * Check if any registered form is currently in a dirty state.
   */
  public isAnyFormDirty(): boolean {
    for (const checker of this.dirtyCheckers) {
      if (checker()) return true
    }
    return false
  }

  /**
   * Number of active overlays.
   */
  public get activeOverlayCount(): number {
    return this.overlayStack.length
  }
}

export const flowOverlayManager = new FlowOverlayManager()

export interface GoBackOptions {
  /** Optional explicit fallback route if no history or returnTo exists */
  fallbackRoute?: string
  /** Skip dirty confirmation check if true */
  skipDirtyCheck?: boolean
}

export interface CompleteFlowOptions {
  /** The fallback destination if no caller returnTo was provided */
  terminalPath?: string
  /** Extra state to pass to destination */
  state?: Record<string, unknown>
}
