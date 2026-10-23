import { defineConfig } from 'vite';

// BASE_PATH: URL prefix when hosted below the domain root (e.g. "/shanhe/" on GitHub Pages).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: { port: 5174, hmr: process.env.NOHMR ? false : undefined },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: id => (id.includes('/node_modules/three/') ? 'three' : undefined) } },
  },
  // module workers: the model builder runs in a Web Worker (see ADR-004)
  worker: { format: 'es' },
});
