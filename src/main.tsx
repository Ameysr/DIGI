import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './lib/auth/AuthProvider'
import { isConfigured } from './lib/env'
import { queryClient } from './lib/queryClient'
import { SetupRequired } from './routes/SetupRequired'

import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

const root = createRoot(container)

if (!isConfigured) {
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
