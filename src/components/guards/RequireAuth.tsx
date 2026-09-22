import { useAuth } from '@/lib/auth/context'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { FullPageSpinner } from '@/components/ui/spinner'

/**
 * Client-side route guard.
 *
 * IMPORTANT: this shapes the user experience, it is not the security boundary.
 * RLS is. Anyone can bypass this in devtools and will still be unable to read a
 * single row they do not own.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) return <FullPageSpinner label="Checking your session…" />

  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
