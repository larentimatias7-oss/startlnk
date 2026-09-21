/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        milicic: {
          orange: '#F39200',
          orangeHover: '#D98200',
          orangeActive: '#B56D00',
          orangeLight: '#FFF8EE',
          slate: '#2A343D',
          slateHover: '#1E262D',
          darkBg: '#0F141A',
          darkCard: '#1A222B',
          darkHeader: '#141A20',
          darkSubtle: '#141B22',
          darkHover: '#222C38',
          borderBase: '#2D3742',
          borderLight: '#242D36',
        },
        tsm: {
          bg: '#0F141A',
          card: '#1A222B',
          cardHover: '#222C38',
          border: '#2D3742',
          emerald: '#38A169',
          cyan: '#3182CE',
          blue: '#3182CE',
          amber: '#F39200',
          rose: '#E53E3E'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
