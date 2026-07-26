/**
 * How a save that went to the offline queue is described to the user.
 *
 * api() resolves a queued mutation as a success, because it is one — the change
 * is durable in IndexedDB and will be sent. But "Saved" with no qualifier reads
 * as "the server has it", and a shopkeeper who then closes the app on a dead
 * connection has no way to know otherwise. The suffix is the whole difference.
 *
 * Internal module — the phrasing lives here so the three features that need it
 * cannot drift into three different promises.
 */

/** The device's own answer, checked per call — connectivity changes mid-save. */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Appends the sync promise when the change has not reached the server.
 * Online, the message is returned untouched.
 */
export function queuedSuffix(message: string): string {
  return isOffline() ? `${message} — will sync when online` : message
}
