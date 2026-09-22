import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthShell } from '@/routes/auth/AuthShell'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { FullPageSpinner, Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth/context'
import { demoCredentials } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export function Login() {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)

  if (!isLoaded) return <FullPageSpinner label="Loading…" />

  // Already signed in: go where they were headed.
  if (isSignedIn) return <Navigate to={from} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message)
      setBusy(false)
      return
    }

    // `from` is applied by the redirect above once the session lands, so there is
    // nothing to navigate to here.
    setBusy(false)
  }

  /**
   * Signs in as the demo subscriber.
   *
   * Navigation is deliberately left to the `isSignedIn` redirect above rather
   * than calling navigate() here. The session arrives asynchronously through
   * `onAuthStateChange`, so navigating immediately would race the dashboard's
   * guard and bounce straight back to this page.
   */
  async function handleDemoLogin() {
    if (!demoCredentials) return

    setError(null)
    setDemoBusy(true)

    const { error: signInError } = await supabase.auth.signInWithPassword(demoCredentials)

    if (signInError) {
      setError(`Demo login failed: ${signInError.message}`)
      setDemoBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your scores, entries and winnings."
      footer={
        <>
          No account yet?{' '}
          <Link to="/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? (
          <Alert tone="danger" title="Could not sign in">
            {error}
          </Alert>
        ) : null}

        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : null}
          Sign in
        </Button>
      </form>

      {/*
        Only rendered when VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD are set, so a
        production build without them ships no demo credentials and no button.
      */}
      {demoCredentials ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs uppercase tracking-wide text-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Button type="button" variant="secondary" onClick={handleDemoLogin} disabled={demoBusy}>
            {demoBusy ? <Spinner /> : null}
            Continue as demo subscriber
          </Button>

          <p className="text-center text-xs text-muted">
            Signs you in to a pre-filled account — an active plan and five logged scores — so you can
            see the whole platform without subscribing.
          </p>
        </div>
      ) : null}
    </AuthShell>
  )
}
