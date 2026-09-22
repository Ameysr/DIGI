import { headerValue, sendError, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabaseAdmin'

/**
 * Monthly cron: makes sure a draft draw exists for the coming month, so an
 * administrator always has something to configure and simulate.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` for scheduled invocations.
 * The same secret is also accepted as a query parameter so the job can be
 * triggered manually.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('cron: CRON_SECRET is not set, refusing to run')
    return sendError(res, 500, 'Cron secret is not configured.')
  }

  const header = headerValue(req, 'authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
  const fromQuery = typeof req.query?.secret === 'string' ? req.query.secret : null

  if (bearer !== expected && fromQuery !== expected) {
    return sendError(res, 401, 'Unauthorized.')
  }

  try {
    const now = new Date()
    // First of next month, in UTC, to match how draws are keyed.
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10)

    const admin = supabaseAdmin()
    const { data, error } = await admin.rpc('ensure_draw_for_month', { p_month: nextMonth })

    if (error) throw error

    return sendJson(res, 200, {
      ok: true,
      drawMonth: nextMonth,
      drawId: (data as { id?: string } | null)?.id ?? null,
    })
  } catch (error) {
    console.error('cron: could not ensure the next draw', error)
    return sendError(
      res,
      500,
      error instanceof Error ? error.message : 'Could not create the next draw.',
    )
  }
}
