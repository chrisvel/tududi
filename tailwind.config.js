/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './frontend/**/*.{js,ts,jsx,tsx}', // Your React components
    './app/views/**/*.erb', // Any .erb templates that might remain
  ],
  theme: {
    extend: {
      keyframes: {
        'scale-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'scale-in': 'scale-in 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
  // theme: {
  //   extend: {
  //     colors: {
  //       // Override the default colors in dark mode
  //       gray: {
  //         50: '#f9f9f9',  // Lightest gray (near white)
  //         100: '#f0f0f0', // Lighter gray
  //         200: '#e0e0e0', // Lighter gray
  //         300: '#c0c0c0', // Light gray
  //         400: '#a0a0a0', // Gray
  //         500: '#808080', // Neutral gray
  //         600: '#606060', // Darker gray
  //         700: '#404040', // Even darker gray
  //         800: '#202020', // Near black
  //         900: '#101010', // Darkest gray (almost black)
  //       },
  //       background: {
  //         DEFAULT: '#000000', // Black background in dark mode
  //       },
  //       text: {
  //         DEFAULT: '#ffffff', // White text in dark mode
  //       },
  //     },
  //   },
  // },
}
