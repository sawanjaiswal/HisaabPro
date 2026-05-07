/** Cash Register — Constants */

export const MAX_EXPRESSION_LEN = 128
export const MAX_NOTE_LEN = 256

/** Rs 10,00,000 in paise — threshold for large-amount warning */
export const LARGE_AMOUNT_PAISE = 100_000_00

/** Rs 10 crore in paise — absolute upper bound */
export const RESULT_OVERFLOW_PAISE = 9_999_999_999

/** Keypad grid layout — 4 rows × 4 columns */
export const KEYPAD_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', 'C', '+'],
] as const

/** All operator characters */
export const OPERATORS = new Set(['+', '-', '*', '/'])

/** React Query cache keys */
export const CASH_QUERY_KEYS = {
  summary: (businessId: string, tzOffsetMinutes: number) =>
    ['cashSummary', businessId, { tzOffsetMinutes }] as const,
  history: (
    businessId: string,
    filter: { direction?: string; includeVoided: boolean },
    sort: { by: string },
    tzOffsetMinutes: number,
  ) => ['cashHistory', businessId, filter, sort, { tzOffsetMinutes }] as const,
  entry: (businessId: string, id: string) =>
    ['cashEntry', businessId, id] as const,
}
