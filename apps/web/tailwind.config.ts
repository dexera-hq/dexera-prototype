import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 0.35rem)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        aura: '0 30px 90px -34px rgba(12, 176, 198, 0.42)',
        panel: '0 28px 90px -44px rgba(2, 6, 23, 0.92)',
      },
      animation: {
        float: 'float 12s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': {
            transform: 'translate3d(0, 0, 0)',
          },
          '50%': {
            transform: 'translate3d(0, -8px, 0)',
          },
        },
      },
      fontFamily: {
        sans: ['Avenir Next', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
        serif: ['Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', 'serif'],
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
