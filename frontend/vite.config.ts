import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Production build outputs to frontend/dist/
  // FastAPI serves this folder when SERVE_FRONTEND=true
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Dev-only proxy: forwards /api requests to the local FastAPI server
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
