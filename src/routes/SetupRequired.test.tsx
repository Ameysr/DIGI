import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const ENV_KEYS = {
  supabaseUrl: 'VITE_SUPABASE_URL',
  supabaseAnonKey: 'VITE_SUPABASE_ANON_KEY',
}

/**
 * The configuration screen is the first thing a new contributor sees, and it
 * exists specifically so a missing publishable key does not render a blank page.
 * If it stops naming the missing variables it has lost its only job.
 *
 * Rendered with renderToStaticMarkup rather than a DOM testing library: this is
 * static output with no interaction to exercise, and it avoids needing act(),
 * which React 19 moved out of react-dom/test-utils.
 *
 * The env module is mocked so the component never depends on whatever
 * `.env.local` happens to exist on the machine running the tests. An earlier
 * version of this file read the real `MISSING_ENV_KEYS`, so it quietly changed
 * meaning — and began failing — the moment a real `.env.local` appeared. A test
 * that depends on the ambient environment is not testing the component.
 */
async function renderWithMissing(missing: (keyof typeof ENV_KEYS)[]) {
  vi.resetModules()
  vi.doMock('@/lib/env', () => ({ ENV_KEYS, MISSING_ENV_KEYS: missing }))
  const { SetupRequired } = await import('./SetupRequired')
  return renderToStaticMarkup(createElement(SetupRequired))
}

describe('SetupRequired', () => {
  it('names every variable that is missing', async () => {
    const markup = await renderWithMissing(['supabaseUrl', 'supabaseAnonKey'])

    expect(markup).toContain('VITE_SUPABASE_URL')
    expect(markup).toContain('VITE_SUPABASE_ANON_KEY')
  })

  it('names only the variables that are actually missing', async () => {
    const markup = await renderWithMissing(['supabaseUrl'])

    expect(markup).toContain('VITE_SUPABASE_URL')
    expect(markup).not.toContain('VITE_SUPABASE_ANON_KEY')
    expect(markup).not.toContain('VITE_CLERK_PUBLISHABLE_KEY')
  })

  it('tells the reader how to fix it rather than just that something is wrong', async () => {
    const markup = await renderWithMissing(['supabaseUrl'])

    expect(markup).toContain('Configuration required')
    // The screen must say auth needs no configuration, since that is the whole
    // reason this project moved to Supabase Auth.
    expect(markup).toMatch(/nothing else to configure/i)
    expect(markup).toMatch(/copy .env.local template/i)
  })
})
