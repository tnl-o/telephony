import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://100.64.0.20:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://100.64.0.20:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
