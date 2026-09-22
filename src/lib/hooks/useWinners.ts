import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import type { ReviewStatus, WinnerWithDraw, WinnerWithProfile } from '@/lib/types'

/** The signed-in user's claims and winnings. */
export function useMyWinnings(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.myWinnings(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<WinnerWithDraw[]> => {
      const { data, error } = await supabase
        .from('winners')
        .select('*, draws(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as WinnerWithDraw[]
    },
  })
}

export function useAllWinners() {
  return useQuery({
    queryKey: queryKeys.allWinners(),
    queryFn: async (): Promise<WinnerWithProfile[]> => {
      const { data, error } = await supabase
        .from('winners')
        .select('*, draws(*), profiles(full_name, email)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as WinnerWithProfile[]
    },
  })
}

/**
 * Upload proof of scores and attach it to the claim.
 *
 * The path is {clerk_user_id}/{draw_id}.{ext} — storage policies derive
 * ownership from that first segment, so a forged path is rejected by the
 * database rather than by this code.
 */
export function useUploadProof() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      drawId,
      file,
    }: {
      userId: string
      drawId: string
      file: File
    }) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${userId}/${drawId}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { error } = await supabase
        .from('winners')
        .update({ proof_path: path })
        .eq('draw_id', drawId)

      if (error) throw error
      return path
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['winnings'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWinners() })
    },
  })
}

/** Admin review. The database blocks these transitions for non-admins. */
export function useReviewWinner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      winnerId,
      reviewStatus,
      reviewedBy,
      rejectionReason,
    }: {
      winnerId: string
      reviewStatus: ReviewStatus
      reviewedBy: string
      rejectionReason?: string
    }) => {
      const { error } = await supabase
        .from('winners')
        .update({
          review_status: reviewStatus,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reviewStatus === 'rejected' ? (rejectionReason ?? null) : null,
        })
        .eq('id', winnerId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWinners() })
      void queryClient.invalidateQueries({ queryKey: ['winnings'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() })
    },
  })
}

export function useMarkPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (winnerId: string) => {
      const { error } = await supabase
        .from('winners')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', winnerId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWinners() })
      void queryClient.invalidateQueries({ queryKey: ['winnings'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() })
    },
  })
}

/** Time-limited signed URL for a private proof image. */
export async function createProofUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 60 * 10)
  if (error) return null
  return data?.signedUrl ?? null
}
