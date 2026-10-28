/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Fredoka"', '"Outfit"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'brutal-xs': '1.5px 1.5px 0px 0px #000000',
        'brutal-sm': '2px 2px 0px 0px #000000',
        'brutal': '4px 4px 0px 0px #000000',
        'brutal-md': '5px 5px 0px 0px #000000',
        'brutal-lg': '6px 6px 0px 0px #000000',
        'brutal-xl': '8px 8px 0px 0px #000000',
        'brutal-white': '4px 4px 0px 0px #FFFFFF',
      },
      borderWidth: {
        '3': '3px',
      },
      colors: {
        brutal: {
          bg: '#FDFBF7',
          canvas: '#F4F0E8',
          yellow: '#FFE600',
          lime: '#4ADE80',
          pink: '#FF69B4',
          hotpink: '#FF1493',
          cyan: '#00F0FF',
          blue: '#38BDF8',
          orange: '#FF5722',
          purple: '#A855F7',
          card: '#FFFFFF',
          dark: '#121212',
          muted: '#E5E0D8',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        slate: {
          850: '#141d2e',
          950: '#090d16',
        }
      }
    },
  },
  plugins: [],
}
