import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** An error that should be shown to the client as `{ "error": message }`. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode

  constructor(status: ContentfulStatusCode, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)
