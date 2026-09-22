import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { apiDevServer } from './plugins/apiDevServer'

export default defineConfig(({ mode }) => {
  // The third argument '' loads every prefix, not just VITE_ — the API handlers
  // need the server-side secrets, which have no prefix on purpose.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Runs api/*.ts under `vite dev`, which otherwise ignores that directory.
      apiDevServer({ env }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 5173,
    },
  }
})
