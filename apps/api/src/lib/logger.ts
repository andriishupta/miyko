type LogFields = Record<string, unknown>
type LogLevel = 'info' | 'warn' | 'error'

const logColors: Record<LogLevel, string> = {
  info: '\u001b[32m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
}
const resetColor = '\u001b[0m'

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const sensitive = /token|secret|password|cookie|authorization|audio|receipt|credential/i.test(key)
    return [key, sensitive ? '[REDACTED]' : redact(entry)]
  }))
}

const formatLog = (level: LogLevel, message: string, fields: LogFields) => {
  const line = JSON.stringify({ level, message, ...redact(fields) as object })
  return process.env.NODE_ENV === 'production' || process.env.NO_COLOR !== undefined
    ? line
    : `${logColors[level]}${line}${resetColor}`
}

export const logger = {
  info(message: string, fields: LogFields = {}) {
    console.info(formatLog('info', message, fields))
  },
  warn(message: string, fields: LogFields = {}) {
    console.warn(formatLog('warn', message, fields))
  },
  error(message: string, fields: LogFields = {}) {
    console.error(formatLog('error', message, fields))
  },
}
