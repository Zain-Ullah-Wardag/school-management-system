import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3299', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:3299', changeOrigin: true }
    }
  },
  build: { outDir: 'release/renderer', emptyOutDir: false }
});
