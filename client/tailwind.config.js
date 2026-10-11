/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F3F3EF',
        surface: '#FFFFFF',
        'surface-2': '#F8F8F5',
        line: '#DCDCD5',
        'line-strong': '#B9B9B0',
        ink: '#1E2227',
        'ink-2': '#4A5058',
        'ink-3': '#6E747C',
        accent: { DEFAULT: '#1F4E8C', hover: '#183F72', soft: '#E6EDF6' },
        success: { DEFAULT: '#2F6B3F', soft: '#E3EFE6' },
        warning: { DEFAULT: '#8A5A00', soft: '#F7EFDD' },
        danger: { DEFAULT: '#A23B32', soft: '#F6E5E3' },
        event: { DEFAULT: '#5B3F8C', soft: '#ECE6F4' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '4px', sm: '2px' },
      fontSize: {
        label: ['12px', { lineHeight: '16px', letterSpacing: '0.06em' }],
        meta: ['14px', '20px'],
        ui: ['15px', '22px'],
        body: ['16px', '26px'],
        title: ['19px', '26px'],
        h2: ['20px', '28px'],
        h1: ['26px', '34px'],
        display: ['32px', '40px'],
      },
      boxShadow: { float: '0 4px 16px rgba(30,34,39,0.12)' },
      transitionTimingFunction: { std: 'cubic-bezier(0.2, 0, 0, 1)' },
    },
  },
  plugins: [],
};
