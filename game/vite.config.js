import { defineConfig } from 'vite';

// Base './' keeps the production build portable (works from any sub-path or file host).
// public/ is served at the web root, so /assets/... resolves to public/assets/...
export default defineConfig({
  base: './',
  server: { host: true, port: 5173, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0 },
});
