/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Enhanced color palette for better accessibility and visual hierarchy
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      // 8px grid system implementation
      spacing: {
        '0.5': '0.125rem',  // 2px
        '1': '0.25rem',     // 4px
        '2': '0.5rem',      // 8px
        '3': '0.75rem',     // 12px
        '4': '1rem',        // 16px
        '5': '1.25rem',     // 20px
        '6': '1.5rem',      // 24px
        '7': '1.75rem',     // 28px
        '8': '2rem',        // 32px
        '10': '2.5rem',     // 40px
        '12': '3rem',       // 48px
        '16': '4rem',       // 64px
        '20': '5rem',       // 80px
        '24': '6rem',       // 96px
        '32': '8rem',       // 128px
        '18': '4.5rem',     // Keep existing
        '88': '22rem',      // Keep existing
      },
      // Enhanced typography scale
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '1rem' }],          // 10px
        'xs': ['0.75rem', { lineHeight: '1rem' }],             // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],         // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],            // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],         // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],          // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],             // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],        // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],          // 36px
        '5xl': ['3rem', { lineHeight: '1' }],                  // 48px
        '6xl': ['3.75rem', { lineHeight: '1' }]                // 60px
      },
      // Enhanced shadows with better depth - keep only working ones
      boxShadow: {
        'dashboard': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'focus': '0 0 0 3px rgba(59, 130, 246, 0.5)',
      },
      // Animation and transition improvements
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      // Container sizes for better content readability
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
        'dashboard': '1400px',
      },
      // Z-index scale
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      // Border radius improvements
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    }
  },
  plugins: [],
}