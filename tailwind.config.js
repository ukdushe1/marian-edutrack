/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef2f2',
          100: '#fde3e3',
          200: '#fccbcc',
          300: '#f9a5a8',
          400: '#f47378',
          500: '#f05055',
          600: '#d8333a',
          700: '#b5272d',
          800: '#962429',
          900: '#7c2327',
          950: '#440e10',
        },
        ink: {
          DEFAULT: '#0b0b0c',
          800: '#1c1c1f',
          700: '#2a2a2e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
