import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'
import { charityMediaUrl, supabase } from '@/lib/supabase/client'
import { assertNoError } from '@/lib/errors'
import type { Charity, CharityEvent } from '@/lib/types'

export function useCharities(search?: string) {
  return useQuery({
    queryKey: queryKeys.charities(search),
    queryFn: async (): Promise<Charity[]> => {
      let query = supabase.from('charities').select('*').eq('is_active', true).order('name')

      if (search?.trim()) {
        const term = `%${search.trim()}%`
        query = query.or(`name.ilike.${term},short_blurb.ilike.${term},description.ilike.${term}`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Charity[]
    },
  })
}

/** The charity spotlighted on the homepage. */
export function useFeaturedCharity() {
  return useQuery({
    queryKey: queryKeys.featuredCharity(),
    queryFn: async (): Promise<Charity | null> => {
      const { data, error } = await supabase
        .from('charities')
        .select('*')
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return (data as Charity | null) ?? null
    },
  })
}

export function useCharity(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.charity(slug ?? ''),
    enabled: Boolean(slug),
    queryFn: async (): Promise<{ charity: Charity; events: CharityEvent[] } | null> => {
      const { data, error } = await supabase
        .from('charities')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const { data: events, error: eventsError } = await supabase
        .from('charity_events')
        .select('*')
        .eq('charity_id', data.id)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')

      if (eventsError) throw eventsError

      return { charity: data as Charity, events: (events ?? []) as CharityEvent[] }
    },
  })
}

/** Update the signed-in user's charity and contribution percentage. */
export function useUpdateMyCharity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      charityId,
      charityPercentage,
    }: {
      userId: string
      charityId: string
      charityPercentage: number
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ charity_id: charityId, charity_percentage: charityPercentage })
        .eq('id', userId)

      assertNoError(error)
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(variables.userId) })
    },
  })
}

export function useMyContributions(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.contributions(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charity_contributions')
        .select('*')
        .order('period_month', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

/* -------------------------------------------------------------------------- */
/* Admin mutations                                                            */
/* -------------------------------------------------------------------------- */

export type CharityFormValues = {
  name: string
  slug: string
  short_blurb: string
  description: string
  website_url: string | null
  image_url: string | null
  is_featured: boolean
  is_active: boolean
}

/**
 * Uploads charity artwork to the public `charity-media` bucket.
 *
 * The bucket is world-readable and already restricted to image MIME types with a
 * size cap, so any client-side checks exist for a fast error message rather than
 * as the real gate — the bucket enforces it regardless of what calls it.
 */
export function useUploadCharityImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      // A random suffix rather than the original filename: two charities both
      // uploading "banner.jpg" must not collide.
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

      const { error } = await supabase.storage
        .from('charity-media')
        .upload(path, file, { upsert: false, contentType: file.type })

      if (error) throw error

      return charityMediaUrl(path)
    },
  })
}

/** All charities, including inactive ones, for the admin list. */
export function useAllCharitiesForAdmin() {
  return useQuery({
    queryKey: ['charities', 'admin'],
    queryFn: async (): Promise<Charity[]> => {
      const { data, error } = await supabase.from('charities').select('*').order('name')
      if (error) throw error
      return (data ?? []) as Charity[]
    },
  })
}

function useInvalidateCharities() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['charities'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.featuredCharity() })
  }
}

export function useCreateCharity() {
  const invalidate = useInvalidateCharities()

  return useMutation({
    mutationFn: async (values: CharityFormValues) => {
      const { error } = await supabase.from('charities').insert(values)
      assertNoError(error)
    },
    onSuccess: invalidate,
  })
}

export function useUpdateCharityRecord() {
  const invalidate = useInvalidateCharities()

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CharityFormValues }) => {
      const { error } = await supabase.from('charities').update(values).eq('id', id)
      assertNoError(error)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteCharity() {
  const invalidate = useInvalidateCharities()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('charities').delete().eq('id', id)
      assertNoError(error)
    },
    onSuccess: invalidate,
  })
}
