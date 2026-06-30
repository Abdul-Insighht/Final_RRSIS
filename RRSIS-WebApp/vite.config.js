import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward all /api/* requests to Flask backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Forward uploaded image requests to Flask backend
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
