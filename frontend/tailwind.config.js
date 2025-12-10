/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Social Analytics Design System
        primary: {
          main: '#10B981',
          hover: '#059669',
        },
        secondary: {
          blue: '#2196F3',
        },
        semantic: {
          positive: '#4CAF50',
          neutral: '#9E9E9E',
          negative: '#EF5350',
        },
        page: '#F4F6F8',
        text: {
          primary: '#212121',
          secondary: '#757575',
        },
        border: '#E0E0E0',
      },
      fontFamily: {
        sans: ['Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'display': '48px',
        'xxl': '32px',
        'xl': '24px',
        'lg': '18px',
        'base': '16px',
        'sm': '14px',
        'xs': '12px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
