import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/sigma-dropdown-auto-selector/',
  build: {
    outDir: 'dist',
    minify: false, // Disable minification to avoid CSP issues
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
})
