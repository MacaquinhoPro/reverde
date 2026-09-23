/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F2F9F5',
          100: '#DDEFE4',
          200: '#C2E2CE',
          300: '#9ECFB2',
          400: '#72B58B',
          500: '#4E9A6C',
          600: '#357C53',
          700: '#1F5D42',
          800: '#174734',
          900: '#0F3324',
        },
        ink: { DEFAULT: '#1C2822', soft: '#6B756F', faint: '#9BA5A0' },
        canvas: '#F8FBF9',
        risk: { low: '#3F9E6B', mid: '#D99A2B', high: '#D96A63' },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      boxShadow: {
        soft: '0 1px 2px rgba(28,40,34,0.04), 0 4px 16px rgba(28,40,34,0.05)',
        lift: '0 2px 4px rgba(28,40,34,0.05), 0 12px 32px rgba(28,40,34,0.09)',
        glow: '0 8px 30px rgba(31,93,66,0.18)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'pulse-ring': { '0%': { transform: 'scale(.9)', opacity: '.7' }, '70%': { transform: 'scale(1.6)', opacity: '0' }, '100%': { opacity: '0' } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .35s ease both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,1,.36,1) both',
        'slide-up': 'slide-up .3s cubic-bezier(.22,1,.36,1) both',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
      },
    },
  },
  plugins: [],
}
