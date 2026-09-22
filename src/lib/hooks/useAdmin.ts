import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DRAW_ELIGIBLE_SCORE_COUNT, SCORE_LIMIT } from '@/lib/constants'
import { queryKeys } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import type { Draw, DrawEntry, Profile, Subscription, UserRole } from '@/lib/types'

export type AdminUser = Profile & { subscriptions: Subscription | null }

export function useAllUsers() {
  return useQuery({
    queryKey: queryKeys.allProfiles(),
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, subscriptions(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as AdminUser[]
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allProfiles() })
    },
  })
}

/** An eligible player and the five numbers they would play. */
export type EligibleEntry = {
  userId: string
  name: string
  email: string
  numbers: number[]
}

/**
 * Everyone who would be entered if the draw ran now: active subscribers holding
 * a full set of scores, with their numbers being their latest five.
 *
 * This mirrors the snapshot taken inside `publish_draw`, which is what lets the
 * admin simulation predict the real outcome.
 */
export function useEligibleEntries() {
  return useQuery({
    queryKey: ['admin', 'eligible-entries'],
    queryFn: async (): Promise<EligibleEntry[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, subscriptions!inner(status), scores(value, played_on, created_at)')
        .eq('subscriptions.status', 'active')

      if (error) throw error

      const rows = (data ?? []) as unknown as (Pick<Profile, 'id' | 'full_name' | 'email'> & {
        scores: { value: number; played_on: string; created_at: string }[]
      })[]

      return rows
        .map((row) => {
          const latest = [...row.scores]
            .sort(
              (a, b) =>
                b.played_on.localeCompare(a.played_on) || b.created_at.localeCompare(a.created_at),
            )
            .slice(0, SCORE_LIMIT)
            .map((score) => score.value)
            .sort((a, b) => a - b)

          return {
            userId: row.id,
            name: row.full_name ?? row.email,
            email: row.email,
            numbers: latest,
          }
        })
        .filter((entry) => entry.numbers.length === DRAW_ELIGIBLE_SCORE_COUNT)
    },
  })
}

export type AdminDrawEntry = DrawEntry & {
  profiles: Pick<Profile, 'full_name' | 'email'> | null
}

export function useDrawEntriesForAdmin(drawId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'entries', drawId],
    enabled: Boolean(drawId),
    queryFn: async (): Promise<AdminDrawEntry[]> => {
      const { data, error } = await supabase
        .from('draw_entries')
        .select('*, profiles(full_name, email)')
        .eq('draw_id', drawId)
        .order('matched_count', { ascending: false })

      if (error) throw error
      return (data ?? []) as AdminDrawEntry[]
    },
  })
}

/**
 * Monthly-normalised value of every active subscription.
 *
 * Yearly plans count as a twelfth of their annual price so a single yearly
 * signup cannot inflate one month's pool. This mirrors the calculation inside
 * `publish_draw`, which is what keeps a simulation honest.
 */
export function useActivePaymentsCents() {
  return useQuery({
    queryKey: ['admin', 'active-payments'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, amount_cents')
        .eq('status', 'active')

      if (error) throw error

      return (data ?? []).reduce((total, row) => {
        const subscription = row as { plan: string; amount_cents: number }
        return total + (subscription.plan === 'yearly' ? subscription.amount_cents / 12 : subscription.amount_cents)
      }, 0)
    },
  })
}

export type AdminStats = {
  totalUsers: number
  activeSubscribers: number
  totalPrizePoolCents: number
  totalCharityCents: number
  publishedDraws: number
  pendingClaims: number
  paidOutCents: number
}

/**
 * Aggregates for the admin overview.
 *
 * Computed client-side from a handful of narrow reads rather than a bespoke SQL
 * function. That is fine at this scale; a production deployment would move
 * these into a materialised view rather than shipping every row to the browser.
 */
export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.adminStats(),
    queryFn: async (): Promise<AdminStats> => {
      const [users, activeSubs, draws, contributions, pending, paid] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('draws').select('total_pool_cents').eq('status', 'published'),
        supabase.from('charity_contributions').select('amount_cents'),
        supabase
          .from('winners')
          .select('*', { count: 'exact', head: true })
          .eq('review_status', 'pending'),
        supabase.from('winners').select('prize_cents').eq('payment_status', 'paid'),
      ])

      const firstError =
        users.error ??
        activeSubs.error ??
        draws.error ??
        contributions.error ??
        pending.error ??
        paid.error
      if (firstError) throw firstError

      const publishedDraws = (draws.data ?? []) as Pick<Draw, 'total_pool_cents'>[]

      return {
        totalUsers: users.count ?? 0,
        activeSubscribers: activeSubs.count ?? 0,
        totalPrizePoolCents: publishedDraws.reduce(
          (total, draw) => total + Number(draw.total_pool_cents),
          0,
        ),
        totalCharityCents: (contributions.data ?? []).reduce(
          (total, row) => total + Number((row as { amount_cents: number }).amount_cents),
          0,
        ),
        publishedDraws: publishedDraws.length,
        pendingClaims: pending.count ?? 0,
        paidOutCents: (paid.data ?? []).reduce(
          (total, row) => total + Number((row as { prize_cents: number }).prize_cents),
          0,
        ),
      }
    },
  })
}
