import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',

      // Only inject the SW registration script in the production build.
      // During dev we don't want the SW intercepting hot-module-reload requests.
      devOptions: { enabled: false },

      workbox: {
        // Precache all app-shell assets produced by the Vite build.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],

        // The main JS bundle is ~6 MB after minification — raise the per-file
        // ceiling so workbox doesn't skip it during precaching.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12 MB

        // SPA fallback: serve index.html for any navigation miss.
        navigateFallback: 'index.html',

        // Don't intercept navigation to external origins (CDN model weights,
        // huggingface.co, etc.). WebLLM already caches those in IndexedDB.
        navigateFallbackDenylist: [/^https?:\/\/(?!localhost)/],
      },

      manifest: {
        name: 'WebGPU Code Reviewer',
        short_name: 'Code Review',
        description:
          'AI-powered code review that runs entirely in your browser via WebGPU — no server, no API key.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
