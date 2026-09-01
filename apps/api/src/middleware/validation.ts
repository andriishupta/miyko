import type { Context } from 'hono'
import { z } from 'zod'
import { AppError } from '../lib/errors.js'

const validationError = () => new AppError('VALIDATION_ERROR', 'Invalid request', 422)

export const parseJson = async <T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw validationError()
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw validationError()
  return parsed.data
}

export const parseQuery = <T extends z.ZodTypeAny>(c: Context, schema: T): z.infer<T> => {
  const parsed = schema.safeParse(c.req.query())
  if (!parsed.success) throw validationError()
  return parsed.data
}

export const parseParams = <T extends z.ZodTypeAny>(c: Context, schema: T): z.infer<T> => {
  const parsed = schema.safeParse(c.req.param())
  if (!parsed.success) throw validationError()
  return parsed.data
}

