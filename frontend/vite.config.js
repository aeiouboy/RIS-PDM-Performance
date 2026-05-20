import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so dashboard is reachable via LAN IP (e.g., from phone)
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      }
      // WebSocket proxy disabled to prevent connection floods
      // '/socket.io': {
      //   target: 'http://localhost:3003',
      //   changeOrigin: true,
      //   ws: true,
      // }
    }
  }
})
