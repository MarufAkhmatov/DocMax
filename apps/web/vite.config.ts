import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  // @docmax/shared ships a real ESM build (dist/esm, `exports.import`) alongside the
  // CJS one apps/api/worker need (M10 fix — Rollup's `vite build` couldn't statically
  // see named exports re-exported via CJS `export *`, e.g. AUDIT_ACTIONS/RELATION_TYPES).
  // Kept in optimizeDeps for consistent pre-bundling across dev/build.
  optimizeDeps: {
    include: ['@docmax/shared'],
  },
});
