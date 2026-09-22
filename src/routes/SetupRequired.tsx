import { AlertTriangle, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { ENV_KEYS, MISSING_ENV_KEYS } from '@/lib/env'

const SETUP_STEPS = [
  'Copy .env.example to .env.local and fill in the two values below.',
  'Create a Supabase project, then apply supabase/migrations in order, followed by supabase/seed.sql.',
  'That is all — authentication is Supabase Auth, so there is nothing else to configure.',
  'Restart the dev server.',
]

/**
 * Shown instead of the app when client credentials are absent.
 *
 * Without this the app renders a blank page, which reads like a code bug rather
 * than a missing configuration step.
 */
export function SetupRequired() {
  const [copied, setCopied] = useState(false)

  const missing = MISSING_ENV_KEYS.map((key) => ENV_KEYS[key])
  const envBlock = `# .env.local\n${Object.values(ENV_KEYS)
    .map((key) => `${key}=`)
    .join('\n')}`

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(envBlock)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="aurora flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <AlertTriangle className="size-6 text-gold" />
          <h1 className="text-2xl font-semibold text-ink">Configuration required</h1>
        </div>

        <p className="text-sm text-muted">
          The app needs Supabase credentials before it can start. These values are missing or still
          contain the placeholders from <code className="text-ink">.env.example</code>:
        </p>

        <ul className="my-4 flex flex-col gap-1.5">
          {missing.map((key) => (
            <li key={key} className="font-mono text-sm text-danger">
              {key}
            </li>
          ))}
        </ul>

        <div className="panel rounded-card p-5">
          <ol className="flex flex-col gap-3 text-sm text-muted">
            {SETUP_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs text-ink">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <button
          type="button"
          onClick={copyTemplate}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-white/[0.05]"
        >
          {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy .env.local template'}
        </button>

        <p className="mt-5 text-xs text-muted">
          Full instructions, including the Supabase and Clerk wiring, are in the project README.
        </p>
      </div>
    </div>
  )
}
