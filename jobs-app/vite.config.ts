/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Published bundles ship without readable source. Debug builds can be
    // produced locally with `vite build --sourcemap`.
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // Placeholders so modules that create the Supabase client can be imported
    // without a local .env (as in CI). No test talks to Supabase.
    env: {
      VITE_SUPABASE_URL: 'https://test.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
})
