import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: ContentfulStatusCode = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const unauthorized = () => new AppError('UNAUTHORIZED', 'Authentication required', 401)
export const forbidden = () => new AppError('FORBIDDEN', 'Insufficient permissions', 403)
export const notFound = (resource = 'Resource') => new AppError('NOT_FOUND', `${resource} not found`, 404)
export const conflict = (message = 'Resource state conflict') => new AppError('CONFLICT', message, 409)
export const tooManyRequests = () => new AppError('RATE_LIMITED', 'Too many requests', 429)
export const providerNotConnected = () => new AppError('PROVIDER_NOT_CONNECTED', 'Store provider connection required', 409)
export const providerReauthorizationRequired = () => new AppError('PROVIDER_REAUTHORIZATION_REQUIRED', 'Store provider authorization required', 401)
