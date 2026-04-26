/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Phase 13: dedicated Web Worker at src/worker/leaseWorker.ts is imported
  // via `new Worker(new URL(...), { type: 'module' })`. Use ES output so
  // the worker chunk can participate in code-splitting (iife — the Vite
  // default for workers — cannot).
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,mjs}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'LeaseGuard',
        short_name: 'LeaseGuard',
        description: 'Private, local-first lease analyzer.',
        theme_color: '#111111',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.bench.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/**/index.ts', // barrel re-exports
        'src/test/**',
        'src/main.tsx',
        'src/parser/env.d.ts',
        'src/parser/testFixtures.ts',
        // Phase 13 Web Worker entry. Pure self.onmessage binding; the logic
        // is in handleRequest.ts which is fully covered. jsdom doesn't
        // execute worker entries so any coverage here is unreachable.
        'src/worker/leaseWorker.ts',
      ],
      thresholds: {
        // Raised 2026-04-25 after Wave 16 Part A test additions
        // (appHelpers, useVersionHistory, clauseClusters edge cases).
        // Actuals sit at 96.63 / 88.31 / 93.03 / 96.63; the +1 branch
        // bump (87 → 88) is the honest ceiling without (a) decomposing
        // App.tsx (38 missed branches; tracked as a Wave 17 candidate)
        // and (b) reducing v8's defensive-guard noise from
        // `noUncheckedIndexedAccess` (`?? 0` / `?? ''` paths it counts
        // as branches but that runtime cannot reach).
        statements: 95,
        branches: 88,
        functions: 91,
        lines: 95,
      },
    },
  },
});
