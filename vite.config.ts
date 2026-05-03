import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/pensive/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['coi-serviceworker.min.js'],
      manifest: {
        name: 'Pensive',
        short_name: 'Pensive',
        description: 'Local-first notes with on-device AI transcription',
        theme_color: '#8B5CF6',
        background_color: '#FAFAF7',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        navigateFallback: null,
      },
    }),
  ],
  optimizeDeps: { exclude: ['@huggingface/transformers', '@mlc-ai/web-llm'] },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tiptap: [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-placeholder',
            '@tiptap/extension-task-list',
            '@tiptap/extension-task-item',
            '@tiptap/extension-mention',
            '@tiptap/extension-image',
            '@tiptap/extension-highlight',
            '@tiptap/suggestion',
          ],
          tables: [
            '@tiptap/extension-table',
            '@tiptap/extension-table-row',
            '@tiptap/extension-table-header',
            '@tiptap/extension-table-cell',
          ],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          fuse: ['fuse.js'],
          transformers: ['@huggingface/transformers'],
          webllm: ['@mlc-ai/web-llm'],
        } as any,
      },
    },
  },
});
