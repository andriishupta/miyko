const csv = (value: string | undefined, fallback: string[]) =>
  value?.split(',').map((item) => item.trim()).filter(Boolean) ?? fallback

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  allowedOrigins: csv(process.env.CORS_ORIGINS, ['http://localhost:8081', 'http://localhost:19006']),
  mockOnly: true,
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10_000),
}

