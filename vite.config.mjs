import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    watch: {
      ignored: [
        '**/data/**',
        '**/*.db',
        '**/*.db-wal',
        '**/*.db-shm',
        '**/server/**',
        '**/scripts/**',
        '**/.git/**'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
