/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-red': {
          DEFAULT: '#ef4444', // red-500
          light: 'rgba(239, 68, 68, 0.1)', // 10% opacity
        },
        'brand-charcoal': '#1f2937', // gray-800
        'brand-off-white': '#f9fafb', // gray-50
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
