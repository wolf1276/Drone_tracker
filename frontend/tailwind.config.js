/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-slate': '#0A0B0E',
        'brand-panel': '#15171D',
        'brand-blue': '#3B82F6',
        'brand-green': '#10B981',
        'brand-amber': '#F59E0B',
        'brand-red': '#EF4444',
        'stellar-purple': '#7C3AED',
        'stellar-indigo': '#4F46E5',
        'stellar-dark': '#010101',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 15px rgba(59, 130, 246, 0.4)',
        'glow-purple': '0 0 15px rgba(124, 58, 237, 0.4)',
        'premium': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}

