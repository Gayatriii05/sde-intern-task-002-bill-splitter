import type { Context } from 'hono'
import { HttpError } from './errors'

const MAX_NAME_LENGTH = 100
const MAX_KEY_LENGTH = 255

/** Reads the JSON body and makes sure it is an object. Bad JSON is a 400. */
export async function readJsonObject(c: Context): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return Object.fromEntries(Object.entries(body))
}

/** A required, non-blank string field. Wrong input is a 422. */
export function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(422, `${field} must be a non-empty string`)
  }
  const text = value.trim()
  if (text.length > MAX_NAME_LENGTH) {
    throw new HttpError(422, `${field} must be at most ${MAX_NAME_LENGTH} characters`)
  }
  return text
}

/** Money: a positive whole number of cents. Strings, decimals, 0 and negatives are rejected. */
export function requireTotalCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new HttpError(422, 'totalCents must be a positive whole number of cents')
  }
  return value
}

/** The Idempotency-Key header is required for payments. Missing or blank is a 400. */
export function requireIdempotencyKey(header: string | undefined): string {
  const key = header?.trim()
  if (!key) throw new HttpError(400, 'Idempotency-Key header is required')
  if (key.length > MAX_KEY_LENGTH) {
    throw new HttpError(400, `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters`)
  }
  return key
}
