import { QueryClient } from '@tanstack/react-query'
import { isSessionRejected } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Subscription and draw state change server-side (payment webhooks, admin
      // publishes), so stale data is refetched on focus and reconnect rather
      // than trusted indefinitely.
      staleTime: 30_000,
      // Retrying a rejected session cannot help — it will fail identically and
      // only buries the real error under a flood of duplicate requests.
      retry: (failureCount, error) => {
        if (isSessionRejected(error)) return false
        return failureCount < 1
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})

/** Query keys, centralised so invalidation never drifts from the fetchers. */
export const queryKeys = {
  profile: (userId: string | null | undefined) => ['profile', userId] as const,
  subscription: (userId: string | null | undefined) => ['subscription', userId] as const,
  scores: (userId: string | null | undefined) => ['scores', userId] as const,
  charities: (search?: string) => ['charities', search ?? ''] as const,
  charity: (slug: string) => ['charity', slug] as const,
  featuredCharity: () => ['charity', 'featured'] as const,
  contributions: (userId: string | null | undefined) => ['contributions', userId] as const,
  draws: () => ['draws'] as const,
  draw: (id: string) => ['draw', id] as const,
  myEntries: (userId: string | null | undefined) => ['draw-entries', userId] as const,
  myWinnings: (userId: string | null | undefined) => ['winnings', userId] as const,
  allWinners: () => ['winners', 'all'] as const,
  allProfiles: () => ['profiles', 'all'] as const,
  allSubscriptions: () => ['subscriptions', 'all'] as const,
  adminStats: () => ['admin', 'stats'] as const,
} as const
