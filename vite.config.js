import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // To dodajemy, żeby naprawić błędy "global is not defined" (Thirdweb fix)
  define: {
    'global': 'window',
    'process.env': {},
  },

  // To Twoje ustawienia (zostawiamy bez zmian, żeby działało na telefonie)
  server: {
    host: '0.0.0.0', 
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})