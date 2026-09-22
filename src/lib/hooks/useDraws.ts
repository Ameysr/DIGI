import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DrawType } from '@/lib/constants'
import { queryKeys } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import type { Draw, DrawEntryWithDraw } from '@/lib/types'

/** Published draws are world-readable; drafts only appear for administrators. */
export function useDraws() {
  return useQuery({
    queryKey: queryKeys.draws(),
    queryFn: async (): Promise<Draw[]> => {
      const { data, error } = await supabase
        .from('draws')
        .select('*')
        .order('draw_month', { ascending: false })

      if (error) throw error
      return (data ?? []) as Draw[]
    },
  })
}

export function useDraw(drawId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.draw(drawId ?? ''),
    enabled: Boolean(drawId),
    queryFn: async (): Promise<Draw | null> => {
      const { data, error } = await supabase
        .from('draws')
        .select('*')
        .eq('id', drawId)
        .maybeSingle()

      if (error) throw error
      return (data as Draw | null) ?? null
    },
  })
}

/** The signed-in user's draw history, newest first. */
export function useMyEntries(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.myEntries(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<DrawEntryWithDraw[]> => {
      const { data, error } = await supabase
        .from('draw_entries')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as DrawEntryWithDraw[]
    },
  })
}

export function useUpdateDrawType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ drawId, drawType }: { drawId: string; drawType: DrawType }) => {
      const { error } = await supabase.from('draws').update({ draw_type: drawType }).eq('id', drawId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.draws() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.draw(variables.drawId) })
    },
  })
}

/**
 * Publish a draw. The winning numbers are produced by the TypeScript engine
 * (crypto-backed and unit-tested) and handed to the `publish_draw` RPC, which
 * validates them and commits the whole draw in one transaction.
 */
export function usePublishDraw() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ drawId, numbers }: { drawId: string; numbers: number[] }) => {
      const { data, error } = await supabase.rpc('publish_draw', {
        p_draw_id: drawId,
        p_winning_numbers: numbers,
      })

      if (error) throw error
      return data as Draw
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.draws() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.draw(variables.drawId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWinners() })
    },
  })
}

export function useCreateDraw() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (month: string) => {
      const { data, error } = await supabase.rpc('ensure_draw_for_month', { p_month: month })
      if (error) throw error
      return data as Draw
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.draws() })
    },
  })
}
