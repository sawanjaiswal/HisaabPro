// #150 Multi-user collaboration — shared FE types.

export type PresenceEntityType = 'party' | 'product' | 'document' | 'payment'

export type PresenceMode = 'viewing' | 'editing'

export interface Peer {
  userId: string
  userName: string
  mode: PresenceMode
}

export interface PeersResponse {
  peers: Peer[]
}

/** Structured 409 payload the optimistic-lock backend returns. */
export interface ConflictInfo {
  serverVersion?: number
  updatedBy?: string | null
}
