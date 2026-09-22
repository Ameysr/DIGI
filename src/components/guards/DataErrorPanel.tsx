import { RefreshCw, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Shown when a query fails, instead of letting the failure look like empty data.
 *
 * That distinction is the whole point. A failed read and a genuinely absent row
 * both produce "no data", and rendering the first as the second tells the user
 * something false — "you have no subscription" when the truth is "we could not
 * load your subscription". That is exactly how a misconfigured auth integration
 * presented itself as a working-but-unsubscribed account.
 *
 * `sessionRejected` switches the guidance: an auth failure has a specific,
 * one-step fix, while any other error just needs to be visible with its message.
 */
export function DataErrorPanel({
  detail,
  sessionRejected = false,
}: {
  detail?: string
  sessionRejected?: boolean
}) {
  return (
    <div className="aurora flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-5 text-gold" />
            <CardTitle>
              {sessionRejected ? 'Supabase rejected your session' : 'Could not load your data'}
            </CardTitle>
          </div>
          <p className="text-sm text-muted">
            {sessionRejected ? (
              <>
                Supabase could not accept the access token, so Row Level Security treated the request
                as anonymous and denied it.
              </>
            ) : (
              <>
                This is an error reading from the database, not an empty result. Anything you see
                elsewhere on this page may be incomplete.
              </>
            )}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 text-sm">
          {sessionRejected ? (
            <div className="flex flex-col gap-3">
              <p className="font-medium text-ink">Usually an expired or invalid session:</p>
              <ol className="flex flex-col gap-2 text-muted">
                <li>
                  <span className="text-ink">1.</span> Sign out and sign back in — an expired token
                  clears itself that way.
                </li>
                <li>
                  <span className="text-ink">2.</span> If that fails, check{' '}
                  <span className="text-ink">VITE_SUPABASE_URL</span> and{' '}
                  <span className="text-ink">VITE_SUPABASE_ANON_KEY</span> point at the same Supabase
                  project the account was created in.
                </li>
                <li>
                  <span className="text-ink">3.</span> Reload this page.
                </li>
              </ol>
            </div>
          ) : null}

          <p className="border-t border-line pt-4 text-xs text-muted">
            {sessionRejected
              ? 'Supabase rejected the access token, so Row Level Security denied the request. Your account and data are unaffected.'
              : 'Reload to retry. If it persists, the message below is the actual database error.'}
          </p>

          {detail ? (
            <details className="text-xs text-muted" open={!sessionRejected}>
              <summary className="cursor-pointer">Technical detail</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white/[0.04] p-3">
                {detail}
              </pre>
            </details>
          ) : null}

          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw />
            Reload
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
