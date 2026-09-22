import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import { AuthLinkErrorScreen } from './components/auth/AuthLinkErrorScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './lib/auth/AuthProvider'
import { readAuthLinkError } from './lib/auth/linkError'
import { isConfigured } from './lib/env'
import { queryClient } from './lib/queryClient'
import { SetupRequired } from './routes/SetupRequired'

import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

const root = createRoot(container)

// Supabase reports an expired or reused email link by appending the error to the
// redirect URL, and supabase-js ignores it. Checked before anything else so the
// failure is explained rather than silently swallowed.
const linkError = readAuthLinkError(window.location.hash)

if (linkError) {
  root.render(<AuthLinkErrorScreen error={linkError} />)
} else if (!isConfigured) {
  // Fail with an actionable checklist rather than a blank page.
  root.render(<SetupRequired />)
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {/*
              AuthProvider reads the persisted Supabase session before anything
              else renders, so route guards can distinguish "not signed in" from
              "not loaded yet" without flashing the wrong screen.
            */}
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
