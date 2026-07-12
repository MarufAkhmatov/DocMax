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
  // @docmax/shared is a linked workspace package built to CommonJS (apps/api/worker
  // need CJS). Vite excludes linked packages from optimizeDeps by default, so its
  // named exports are served raw over @fs — cjs-module-lexer's static scan of that
  // unbundled file misses re-exported (`export *`) bindings, which breaks any
  // runtime (non-type) import from it (harmless until the first one was added).
  // Forcing it through esbuild's pre-bundling gives reliable CJS→ESM interop.
  optimizeDeps: {
    include: ['@docmax/shared'],
  },
});
