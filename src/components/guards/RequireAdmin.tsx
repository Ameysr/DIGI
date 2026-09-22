import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { DataErrorPanel } from '@/components/guards/DataErrorPanel'
import { Button } from '@/components/ui/button'
import { FullPageSpinner } from '@/components/ui/spinner'
import { errorText, isSessionRejected } from '@/lib/errors'
import { useProfile } from '@/lib/hooks/useProfile'
import { Link } from 'react-router-dom'

/** Administrators only. RLS enforces the same rule server-side. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoading, profile, isAdmin, error } = useProfile()

  if (isLoading) return <FullPageSpinner label="Checking permissions…" />

  // ANY error surfaces here, not just an auth failure. A failed read used to fall
  // through to "Administrators only", which blames the user's role for what is
  // actually a database or session problem.
  if (error) {
    return <DataErrorPanel sessionRejected={isSessionRejected(error)} detail={errorText(error)} />
  }

  if (!profile || !isAdmin) {
    return (
      <div className="aurora flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="size-8 text-gold" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-ink">Administrators only</h1>
          <p className="max-w-md text-sm text-muted">
            This area manages users, draws and payouts. Your account does not have the admin role.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
