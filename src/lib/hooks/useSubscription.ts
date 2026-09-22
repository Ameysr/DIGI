import { useAuth } from '@/lib/auth/context'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import { applyPeriod, NO_SUBSCRIPTION, type SubscriptionState } from '@/lib/subscription-state'
import type { Subscription } from '@/lib/types'

/**
 * Subscription state for the signed-in user.
 *
 * The effective status is derived from the paid period rather than read straight
 * from the row, because nothing renews automatically — see `applyPeriod`.
 *
 * The derivation runs inside `queryFn`, not during render. That keeps the
 * component pure (no clock read mid-render) and makes the answer deterministic
 * for a given fetch. The query refetches on focus and reconnect with a short
 * stale time, so an expiry is picked up without a polling loop.
 */
export function useSubscription() {
  const { userId } = useAuth()

  const query = useQuery({
    queryKey: queryKeys.subscription(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<SubscriptionState> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      return applyPeriod((data as Subscription | null) ?? null, new Date())
    },
  })

  const state = query.data ?? NO_SUBSCRIPTION

  return {
    ...query,
    subscription: state.subscription,
    status: state.status,
    isActive: state.isActive,
    hasLapsed: state.hasLapsed,
  }
}
