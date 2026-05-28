// #150 Multi-user collaboration — presence types.
// Presence is ephemeral, in-memory, per-business. It never persists to the DB.

/** Entities a user can be "present" on. Mirrors the optimistic-lock models. */
export type PresenceEntityType = 'party' | 'product' | 'document' | 'payment'

export type PresenceMode = 'viewing' | 'editing'

/** A single user's current focus within one business (one entry per user). */
export interface PresenceEntry {
  userId: string
  userName: string
  entityType: PresenceEntityType
  entityId: string
  mode: PresenceMode
  lastSeen: number // epoch ms — TTL-swept
}

/** What other clients see — never leaks lastSeen or cross-entity focus. */
export interface Peer {
  userId: string
  userName: string
  mode: PresenceMode
}
