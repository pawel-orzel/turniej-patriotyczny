import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    'process.env.APP_VERSION': JSON.stringify('2.0.0')
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
})
