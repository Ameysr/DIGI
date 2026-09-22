import { useAuth } from '@/lib/auth/context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import type { Score } from '@/lib/types'
import { SCORE_LIMIT } from '@/lib/constants'

export function useScores() {
  const { userId } = useAuth()

  return useQuery({
    queryKey: queryKeys.scores(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Score[]> => {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .order('played_on', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Score[]
    },
  })
}

/** Scores are entered as a date and a Stableford value. */
export type ScoreInput = { value: number; playedOn: string }

export function useAddScore() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ value, playedOn }: ScoreInput) => {
      const { error } = await supabase
        .from('scores')
        .insert({ user_id: userId, value, played_on: playedOn })

      if (error) throw error
    },
    onSuccess: () => {
      // The retention trigger may have pruned an older row, so refetch rather
      // than patching the cache by hand.
      void queryClient.invalidateQueries({ queryKey: queryKeys.scores(userId) })
    },
  })
}

export function useUpdateScore() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      value,
      playedOn,
    }: ScoreInput & { id: string }) => {
      const { error } = await supabase
        .from('scores')
        .update({ value, played_on: playedOn })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scores(userId) })
    },
  })
}

export function useDeleteScore() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scores').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scores(userId) })
    },
  })
}

/** True once the player holds a full set, which is what makes them draw-eligible. */
export function isDrawEligible(scores: Score[] | undefined): boolean {
  return (scores?.length ?? 0) >= SCORE_LIMIT
}
