/** Godowns/Warehouses — Constants */

export const GODOWN_PAGE_SIZE = 20
export const GODOWN_NAME_MAX = 100
export const ADDRESS_MAX = 500
export const TRANSFER_NOTES_MAX = 500

export const GODOWN_TABS = [
  { id: 'godowns', label: 'Godowns' },
  { id: 'transfers', label: 'Transfers' },
] as const

export type GodownTab = (typeof GODOWN_TABS)[number]['id']
