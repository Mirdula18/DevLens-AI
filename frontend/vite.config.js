import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend during development
    proxy: {
      '/upload': 'http://localhost:8000',
      '/tree': 'http://localhost:8000',
      '/file': 'http://localhost:8000',
      '/explain': 'http://localhost:8000',
      '/summary': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
