import { defineConfig } from 'vite';

// BASE_PATH: URL prefix when hosted below the domain root (e.g. "/ages/" on GitHub Pages).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: { port: 5174, hmr: process.env.NOHMR ? false : undefined },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: id => {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/src/shared/data/jiangshan') || id.includes('/src/shared/data/lessons')) return 'atlas-chronicle';
          if (id.includes('/src/shared/data/')) return 'atlas-data';
          return undefined;
        },
      },
    },
  },
  // module workers: the model builder runs in a Web Worker (see ADR-004)
  worker: { format: 'es' },
});
