/**
 * Session-scoped form drafts — one place, one storage contract.
 *
 * A shopkeeper on a Rs 8K Android phone loses the app mid-form to a call, a
 * low-memory kill, or an accidental back gesture. Anything they typed and had
 * not yet submitted must still be there when they come back, and every
 * multi-step form in the app needs the same three operations to make that true.
 *
 * `sessionStorage`, never `localStorage`: these payloads carry entity data
 * (business name, customer segment) and OFFLINE_RULES rule 4 keeps that out of
 * localStorage. Session scope is also the honest lifetime — the draft belongs
 * to this tab and this visit, and an Android process kill clears it, which is
 * the limit of what web storage can promise.
 *
 * Every operation is best-effort: private mode, a full quota, or a disabled
 * storage API must degrade to "no draft", never to a thrown error inside a
 * render or a submit handler.
 */

export interface SessionDraft<T> {
  /** Whatever survived, or `{}` — never throws, never returns null. */
  load(): Partial<T>
  save(value: T): void
  clear(): void
}

export function createSessionDraft<T extends object>(key: string): SessionDraft<T> {
  return {
    load(): Partial<T> {
      try {
        const raw = sessionStorage.getItem(key)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as unknown
        // A hand-edited or half-written value must not reach the form as a
        // string or an array pretending to be state.
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return parsed as Partial<T>
      } catch {
        return {}
      }
    },

    save(value: T): void {
      try {
        sessionStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage unavailable or full — the form keeps working without a draft.
      }
    },

    clear(): void {
      try {
        sessionStorage.removeItem(key)
      } catch {
        // noop
      }
    },
  }
}
