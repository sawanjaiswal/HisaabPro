/** Items Library — Type definitions */

export interface LibraryItem {
  id: string
  name: string
  category: string
  hsn?: string
  unit?: string
  /** Suggested retail rate in paise (0 = no suggestion) */
  suggestedRate: number
}

export interface LibraryCategory {
  id: string
  name: string
  icon: string
  itemCount: number
}
