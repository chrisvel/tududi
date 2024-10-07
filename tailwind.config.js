/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/frontend/**/*.{js,ts,jsx,tsx}', // Your React components
    './app/views/**/*.erb', // Any .erb templates that might remain
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
