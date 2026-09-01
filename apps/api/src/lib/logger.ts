type LogFields = Record<string, unknown>

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const sensitive = /token|secret|password|cookie|authorization|audio|receipt|credential/i.test(key)
    return [key, sensitive ? '[REDACTED]' : redact(entry)]
  }))
}

export const logger = {
  info(message: string, fields: LogFields = {}) {
    console.info(JSON.stringify({ level: 'info', message, ...redact(fields) as object }))
  },
  warn(message: string, fields: LogFields = {}) {
    console.warn(JSON.stringify({ level: 'warn', message, ...redact(fields) as object }))
  },
  error(message: string, fields: LogFields = {}) {
    console.error(JSON.stringify({ level: 'error', message, ...redact(fields) as object }))
  },
}

