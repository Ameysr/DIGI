import { CircleAlert } from 'lucide-react'
import type { AuthLinkError } from '@/lib/auth/linkError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Shown when an email link comes back with an error.
 *
 * Rendered before the app itself, because these errors arrive on whatever URL
 * Supabase is configured to redirect to — usually the site root — so handling it
 * on one particular route would miss most of them.
 */
export function AuthLinkErrorScreen({ error }: { error: AuthLinkError }) {
  function continueToApp() {
    // Drop the error from the address bar before continuing, so a refresh does
    // not re-trigger this screen.
    window.location.replace(window.location.pathname)
  }

  return (
    <div className="aurora flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CircleAlert className="size-5 text-gold" />
            <CardTitle>{error.message}</CardTitle>
          </div>
          <p className="text-sm text-muted">{error.advice}</p>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 text-sm">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.replace('/login')}>Go to sign in</Button>
            <Button variant="secondary" onClick={() => window.location.replace('/signup')}>
              Sign up again
            </Button>
          </div>

          <p className="border-t border-line pt-4 text-xs text-muted">
            Nothing is wrong with your account — confirmation links are simply single-use and
            time-limited. Requesting a new one resolves it.
          </p>

          {error.detail ? (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Technical detail</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white/[0.04] p-3">
                {error.code ? `${error.code}: ` : ''}
                {error.detail}
              </pre>
            </details>
          ) : null}

          <Button variant="ghost" onClick={continueToApp}>
            Continue to the site
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
