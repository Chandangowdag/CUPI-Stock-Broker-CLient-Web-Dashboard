/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          0: '#0a0d12',
          1: '#111620',
          2: '#181f2e',
          3: '#1e2737',
        },
        accent: {
          cyan: '#00e5ff',
          green: '#00ff88',
          red: '#ff4466',
          gold: '#ffd166',
        },
        border: '#1e2d45',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'pulse-green': { '0%,100%': { boxShadow: '0 0 0 0 rgba(0,255,136,0.4)' }, '50%': { boxShadow: '0 0 0 6px rgba(0,255,136,0)' } },
        'price-flash': { '0%': { color: '#00ff88' }, '100%': { color: 'inherit' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-green': 'pulse-green 2s infinite',
        'price-flash': 'price-flash 0.4s ease-out',
      },
    },
  },
  plugins: [],
}
