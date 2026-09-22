import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthUser, type AuthValue } from '@/lib/auth/context'
import { supabase } from '@/lib/supabase/client'

function toUser(session: Session | null): AuthUser | null {
  const account = session?.user
  if (!account) return null

  const metadata = account.user_metadata ?? {}

  return {
    id: account.id,
    email: account.email ?? null,
    fullName:
      (metadata.full_name as string | undefined) ??
      (metadata.name as string | undefined) ??
      null,
  }
}

/**
 * Session state, from Supabase Auth.
 *
 * `getSession()` resolves the persisted session on mount, and
 * `onAuthStateChange` keeps it current for sign-in, sign-out and token refresh.
 * Both write through the same state, so a guard never sees a stale value.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setIsLoaded(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoaded(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      isLoaded,
      isSignedIn: Boolean(session),
      userId: session?.user?.id ?? null,
      user: toUser(session),
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [isLoaded, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
