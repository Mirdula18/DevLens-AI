import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend URL for the dev/preview proxy (override with DEVLENS_API_URL)
const target = process.env.DEVLENS_API_URL ?? 'http://localhost:8000'

const apiRoutes = ['/upload', '/tree', '/file', '/explain', '/summary', '/chat', '/models', '/stats', '/health']

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend during development
    proxy: Object.fromEntries(apiRoutes.map(route => [route, target])),
  },
})
