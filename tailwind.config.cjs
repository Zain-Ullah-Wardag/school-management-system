/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effcf5', 100: '#d9f8e8', 200: '#b7f0d2', 300: '#7fe3af',
          400: '#40cd83', 500: '#1aae66', 600: '#0b8c51', 700: '#087043',
          800: '#0a5938', 900: '#08492f'
        },
        ink: '#16231d',
        muted: '#66756d',
        canvas: '#f6f8f7'
      },
      boxShadow: {
        panel: '0 1px 3px rgba(20, 42, 30, .07), 0 10px 30px rgba(20, 42, 30, .04)',
        float: '0 18px 48px rgba(17, 52, 35, .15)'
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'], urdu: ['Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'serif'] }
    }
  },
  plugins: []
};
