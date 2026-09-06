const csv = (value: string | undefined) => {
  const values = value?.split(',').map((item) => item.trim()).filter(Boolean) ?? []
  if (values.length === 0) throw new Error('CORS_ORIGINS is required')
  return values
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST?.trim() || '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  allowedOrigins: csv(process.env.CORS_ORIGINS),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10_000),
}
