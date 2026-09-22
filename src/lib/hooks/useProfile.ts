import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/context'
import { queryKeys } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

/**
 * The signed-in user's profile row.
 *
 * Normally created by the `on_auth_user_created` database trigger at signup. The
 * insert below is a fallback for accounts that predate the trigger, so a missing
 * row degrades into a self-heal rather than a broken screen.
 */
export function useProfile() {
  const { user, isLoaded } = useAuth()
  const userId = user?.id ?? null

  const query = useQuery({
    queryKey: queryKeys.profile(userId),
    enabled: isLoaded && Boolean(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error
      if (data) return data as Profile

      const { data: created, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user?.email ?? '',
          full_name: user?.fullName ?? null,
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      return created as Profile
    },
  })

  return {
    ...query,
    profile: query.data ?? null,
    userId,
    isAdmin: query.data?.role === 'admin',
  }
}
