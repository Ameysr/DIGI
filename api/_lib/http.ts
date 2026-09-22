import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Minimal request/response shapes for Vercel's Node functions.
 *
 * Declared locally rather than pulling in @vercel/node, which drags a large
 * vulnerable toolchain in for the sake of a few type definitions.
 */
export type ApiRequest = IncomingMessage & {
  body?: unknown
  rawBody?: Buffer | string
  query?: Record<string, string | string[] | undefined>
}

export type ApiResponse = ServerResponse

export function sendJson(res: ApiResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export function sendError(res: ApiResponse, status: number, message: string): void {
  sendJson(res, status, { error: message })
}

export function headerValue(req: ApiRequest, name: string): string | null {
  const raw = req.headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw ?? null
}

function parseJson(buffer: Buffer): unknown {
  if (buffer.length === 0) return {}
  return JSON.parse(buffer.toString('utf8'))
}

/**
 * The unparsed request body, as a Buffer.
 *
 * Webhook signature verification (Razorpay, Svix) must run against the exact bytes
 * the provider sent — re-serialising a parsed object changes key order and
 * whitespace and the signature will never match. This prefers a pre-read raw
 * body when the platform supplies one, and otherwise consumes the stream.
 */
export async function readRawBody(req: ApiRequest): Promise<Buffer> {
  if (req.rawBody) {
    return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody)
  }

  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)

  if (req.body && typeof req.body === 'object') {
    throw new Error(
      'The request body was parsed before it reached the handler, so its signature cannot be verified. ' +
        'Disable body parsing for this function (bodyParser: false).',
    )
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks)
}

/** Parsed JSON body, accepting either a pre-parsed body or a raw stream. */
export async function readJsonBody<T>(req: ApiRequest): Promise<T> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as T
  }
  return parseJson(await readRawBody(req)) as T
}
