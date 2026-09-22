/**
 * Client environment validation.
 *
 * Only two values now, because authentication is handled by Supabase itself —
 * there is no third-party provider to name a key for.
 */

type ClientEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

const raw: ClientEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}

/** Values copied straight from `.env.example` are treated as unset. */
function isPlaceholder(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return /your-|xxxxxxxx|your-project-ref/.test(trimmed)
}

export const MISSING_ENV_KEYS = (Object.keys(raw) as (keyof ClientEnv)[]).filter((key) =>
  isPlaceholder(raw[key]),
)

export const ENV_KEYS: Record<keyof ClientEnv, string> = {
  supabaseUrl: 'VITE_SUPABASE_URL',
  supabaseAnonKey: 'VITE_SUPABASE_ANON_KEY',
}

export const isConfigured = MISSING_ENV_KEYS.length === 0

export const env: ClientEnv = raw

/**
 * Optional one-click demo account, for a reviewer to get straight in.
 *
 * Gated on configuration rather than hardcoded, so a production build simply
 * omits the two variables and the button disappears — no demo credentials baked
 * into a deployed bundle.
 */
const demoEmail = (import.meta.env.VITE_DEMO_EMAIL ?? '').trim()
const demoPassword = (import.meta.env.VITE_DEMO_PASSWORD ?? '').trim()

export const demoCredentials =
  demoEmail && demoPassword ? { email: demoEmail, password: demoPassword } : null
