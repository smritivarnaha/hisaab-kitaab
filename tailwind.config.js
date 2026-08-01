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
        wise: {
          lime: '#93E044',        // Official Wise Bright Lime Green
          limeHover: '#84D137',
          darkGreen: '#0D2E14',   // Official Wise Dark Forest Green Text/Header
          paleGreen: '#E4ECE2',   // Wise Active Pill Background
          bg: '#F3F5F1',          // Wise App Background
          cardBg: '#EDF2EC',      // Wise Subtle Light Card Surface
          yellow: '#FFE855',      // Wise Warm Yellow Accent Card
          border: '#E2E8E0',
          red: '#D93025',
          redBg: '#FCE8E6',
        },
        qor: {
          lime: '#93E044',
          limeBright: '#93E044',
          limeLight: '#E4ECE2',
          limeDark: '#0D2E14',
          bg: '#F3F5F1',
          card: '#ffffff',
          dark: '#0D2E14',
          darkHover: '#1C3B1E',
          muted: '#6b7280',
          border: '#E2E8E0',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Plus Jakarta Sans', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
        jakarta: ['Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
