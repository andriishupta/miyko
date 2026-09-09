/** Serialize a JavaScript Date before passing it to a raw PostgreSQL query. */
export const toPostgresTimestamp = (value: Date): string => value.toISOString()

/** Normalize a timestamp returned by a raw PostgreSQL query. */
export const fromPostgresTimestamp = (value: Date | string): Date => value instanceof Date ? value : new Date(value)
