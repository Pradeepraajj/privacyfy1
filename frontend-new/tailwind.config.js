/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#0d3ecf',
        'glow-cyan': '#00c2ff',
      },
      boxShadow: {
        'glow': '0 0 15px rgba(0, 194, 255, 0.7)',
      }
    },
  },
  plugins: [],
};