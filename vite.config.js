import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // ZACHOWUJEMY: To naprawia błędy Thirdweb (ważne!)
  define: {
    'global': 'window',
    'process.env': {},
  },

  // ZACHOWUJEMY: Twoje ustawienia serwera (dla telefonu)
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

  // DODAJEMY: To jest ta część dla Vercela, o którą nam chodziło
  build: {
    outDir: 'dist',
  }
})