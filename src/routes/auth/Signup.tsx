import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthShell } from '@/routes/auth/AuthShell'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { FullPageSpinner, Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth/context'
import { supabase } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 8

export function Signup() {
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  if (!isLoaded) return <FullPageSpinner label="Loading…" />
  if (isSignedIn) return <Navigate to="/onboarding" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`)
      return
    }

    setBusy(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setBusy(false)
      return
    }

    // No session means the project requires email confirmation. The profile row
    // is still created by the `on_auth_user_created` trigger either way.
    if (!data.session) {
      setAwaitingConfirmation(true)
      setBusy(false)
      return
    }

    setBusy(false)
    navigate('/onboarding')
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Confirm your email">
        <Alert tone="info" title="One more step">
          We sent a confirmation link to <span className="text-ink">{email}</span>. Follow it, then
          sign in.
        </Alert>
        <p className="text-xs text-muted">
          Running this locally and do not want to fetch email? Turn off{' '}
          <span className="text-ink">Authentication → Sign In / Providers → Email → Confirm
          email</span> in Supabase, and new signups will be active immediately.
        </p>
        <Button asChild variant="secondary">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Then choose a plan and a charity to support."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="full-name">
          <Input
            id="full-name"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>

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

        <Field
          label="Password"
          htmlFor="password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? (
          <Alert tone="danger" title="Could not create your account">
            {error}
          </Alert>
        ) : null}

        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : null}
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
