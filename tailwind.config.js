/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: '#00F0FF',
          purple: '#9D4EDD',
          pink: '#FF006E',
          green: '#06FFA5',
          orange: '#FF9E00',
        },
        dark: {
          bg: '#0A0E27',
          card: '#1A1F3A',
          border: '#2D3561',
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { 
            opacity: '1',
            transform: 'scale(1)',
          },
          '50%': { 
            opacity: '0.7',
            transform: 'scale(1.05)',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { 
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 240, 255, 0.5)',
        'neon-purple': '0 0 20px rgba(157, 78, 221, 0.5)',
        'neon-pink': '0 0 20px rgba(255, 0, 110, 0.5)',
      }
    },
  },
  plugins: [],
}