// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit({
      onwarn: (warning, handler) => {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        handler(warning);
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    SUPERFORMS_LEGACY: true
  }
});