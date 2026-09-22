import { createContext, useContext } from 'react'

export type AuthUser = {
  id: string
  email: string | null
  fullName: string | null
}

export type AuthValue = {
  /** False until the persisted session has been read, so guards can wait. */
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  user: AuthUser | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

/**
 * Session state for the signed-in user.
 *
 * Kept in its own module so the provider file exports a component and nothing
 * else — mixing the two breaks React fast refresh for the whole file.
 */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
