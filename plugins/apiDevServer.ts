import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Runs the Vercel functions in `api/` inside the Vite dev server.
 *
 * `vite dev` knows nothing about `api/` — that directory is executed by Vercel's
 * runtime — so without this every `/api/*` request 404s locally, and subscribing
 * can never be tested with `npm run dev`.
 *
 * `vercel dev` is the official alternative, but it needs the Vercel CLI plus an
 * interactive login and link, which is more friction than this is worth for
 * local work. Production is unaffected: Vercel still runs the functions.
 *
 * The handlers are loaded through `ssrLoadModule`, so they are transpiled by
 * Vite and Node dependencies stay external. Importantly, the request body is
 * left as a raw stream, which is exactly what the webhook signature checks need
 * — nothing has parsed or re-serialised it.
 */
export function apiDevServer(options: { env: Record<string, string> }): Plugin {
  return {
    name: 'digital-heroes:api-dev-server',
    apply: 'serve',

    configureServer(server) {
      // The functions read process.env. Vite only loads .env files into
      // import.meta.env, and only exposes VITE_-prefixed values to the client,
      // so the server-side values have to be bridged across explicitly.
      for (const [key, value] of Object.entries(options.env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const requestPath = (req.url ?? '').split('?')[0]
        if (!requestPath.startsWith('/api/')) return next()

        const file = resolveFunctionFile(requestPath)
        if (!file) return next()

        try {
          const module = (await server.ssrLoadModule(file)) as {
            default?: (request: unknown, response: unknown) => unknown
          }

          if (typeof module.default !== 'function') {
            res.statusCode = 500
            res.end(`${file} has no default export`)
            return
          }

          // Parity with Vercel, which populates req.query. The cron endpoint
          // accepts its secret that way.
          const query = Object.fromEntries(
            new URLSearchParams((req.url ?? '').split('?')[1] ?? ''),
          )
          Reflect.set(req, 'query', query)

          await module.default(req, res)
        } catch (error) {
          if (error instanceof Error) server.ssrFixStacktrace(error)
          console.error(`[api] ${requestPath} threw`, error)

          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'The dev API handler threw. The full error is in the terminal.',
              }),
            )
          }
        }
      })
    },
  }
}

/**
 * Maps `/api/billing` to `api/billing.ts`, and `/api/webhooks/clerk` to
 * `api/webhooks/clerk.ts`.
 *
 * The traversal guard matters: without it, a request for
 * `/api/../../etc/passwd.ts` would resolve outside the project.
 */
function resolveFunctionFile(urlPath: string): string | null {
  const relative = urlPath.replace(/^\//, '')

  if (!relative.startsWith('api/') || relative.includes('..')) return null

  const candidates = [resolve(`${relative}.ts`), resolve(relative, 'index.ts')]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}
