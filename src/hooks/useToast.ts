/**
 * Toast Notification Hook — direct from HisaabPro
 * Global toast state management using Zustand
 */

import { create } from 'zustand';
import type { ReactNode } from 'react';

export const TOAST_DURATION = 5000;
export const TOAST_ERROR_DURATION = 8000;
const DEDUP_WINDOW_MS = 3000;
const MAX_VISIBLE_TOASTS = 3;

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string | ReactNode;
  createdAt: number;
  onUndo?: () => void;
  undoLabel?: string;
  code?: string;
  status?: number;
  detail?: unknown;
  duration?: number;
}

export type ToastInput = {
  type: Toast['type'];
  message: string | ReactNode;
  onUndo?: () => void;
  undoLabel?: string;
  code?: string;
  status?: number;
  detail?: unknown;
  duration?: number;
};

interface ToastStore {
  toasts: Toast[];
  timeouts: Map<string, ReturnType<typeof setTimeout>>;
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  timeouts: new Map(),
  addToast: (toast) => {
    const { toasts, timeouts, removeToast } = get();
    const now = Date.now();

    // Dedup: skip if same type + message exists within window
    const isDuplicate = toasts.some(
      (t) =>
        t.type === toast.type &&
        t.message === toast.message &&
        now - t.createdAt < DEDUP_WINDOW_MS,
    );
    if (isDuplicate) return;

    // Evict oldest if at max
    if (toasts.length >= MAX_VISIBLE_TOASTS) {
      removeToast(toasts[0].id);
    }

    const id = crypto.randomUUID();
    const newToast: Toast = { ...toast, id, createdAt: now };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    const duration = toast.duration ?? (toast.type === 'error' ? TOAST_ERROR_DURATION : TOAST_DURATION);

    const timeoutId = setTimeout(() => {
      const { timeouts: t } = get();
      t.delete(id);
      set((state) => ({
        toasts: state.toasts.filter((v) => v.id !== id),
        timeouts: new Map(t),
      }));
    }, duration);

    timeouts.set(id, timeoutId);
    set({ timeouts: new Map(timeouts) });
  },
  removeToast: (id) => {
    const { timeouts } = get();
    const timeoutId = timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(id);
    }

    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
      timeouts: new Map(timeouts),
    }));
  },
  clearAll: () => {
    const { timeouts } = get();
    timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    timeouts.clear();

    set({ toasts: [], timeouts: new Map() });
  },
}));

export type ToastOptions = {
  onUndo?: () => void;
  undoLabel?: string;
  code?: string;
  status?: number;
  detail?: unknown;
  duration?: number;
};

/**
 * Convenience hook for using toasts
 */
export const useToast = () => {
  const { addToast, removeToast, clearAll } = useToastStore();

  return {
    success: (message: string | ReactNode, options?: ToastOptions) =>
      addToast({ type: 'success', message, ...options }),
    error: (errorOrMessage: unknown, options?: ToastOptions) => {
      let message: string | ReactNode = 'An unexpected error occurred';
      let code = options?.code;
      let status = options?.status;
      let detail = options?.detail;

      if (typeof errorOrMessage === 'string') {
        message = errorOrMessage;
      } else if (errorOrMessage && typeof errorOrMessage === 'object') {
        const err = errorOrMessage as Record<string, unknown>;
        if (typeof err.message === 'string') {
          message = err.message;
        }
        if (typeof err.code === 'string') {
          code = code ?? err.code;
        }
        if (typeof err.status === 'number') {
          status = status ?? err.status;
        }
        if (err.detail !== undefined) {
          detail = detail ?? err.detail;
        } else if (err.details !== undefined) {
          detail = detail ?? err.details;
        } else if (err.cause !== undefined) {
          detail = detail ?? err.cause;
        }
      }

      addToast({
        type: 'error',
        message,
        code,
        status,
        detail,
        ...options,
      });
    },
    info: (message: string | ReactNode, options?: ToastOptions) =>
      addToast({ type: 'info', message, ...options }),
    warning: (message: string | ReactNode, options?: ToastOptions) =>
      addToast({ type: 'warning', message, ...options }),
    remove: removeToast,
    clearAll,
  };
};
