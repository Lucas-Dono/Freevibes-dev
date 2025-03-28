/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        "card-bg": "var(--card-bg)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "border-color": "var(--border-color)",
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--primary-light)",
          lighter: "var(--primary-lighter)", 
          dark: "var(--primary-dark)",
          darker: "var(--primary-darker)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          light: "var(--secondary-light)",
          lighter: "var(--secondary-lighter)",
          dark: "var(--secondary-dark)",
          darker: "var(--secondary-darker)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
          lighter: "var(--accent-lighter)",
          dark: "var(--accent-dark)",
          darker: "var(--accent-darker)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        info: "var(--info)",
        gray: {
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
          950: '#030712',
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        body: ["var(--font-outfit)", "sans-serif"],
        mono: ["var(--font-space-grotesk)", "monospace"],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 30px -5px rgba(124, 58, 237, 0.3)',
        'glow-lg': '0 0 50px -10px rgba(124, 58, 237, 0.4)',
        'glow-xl': '0 25px 50px -12px rgba(124, 58, 237, 0.25)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'pulse-slow': 'pulse 6s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'noise': "url('/images/noise.png')",
        'mesh-gradient': 'linear-gradient(to bottom right, var(--bg-gradient-from), var(--bg-gradient-to))',
      },
      backdropBlur: {
        xs: '2px',
      },
      typography: {
        DEFAULT: {
          css: {
            color: 'var(--text-primary)',
            a: {
              color: 'var(--primary)',
              '&:hover': {
                color: 'var(--primary-light)',
              },
            },
            h1: {
              color: 'var(--text-primary)',
            },
            h2: {
              color: 'var(--text-primary)',
            },
            h3: {
              color: 'var(--text-primary)',
            },
            h4: {
              color: 'var(--text-primary)',
            },
            strong: {
              color: 'var(--text-primary)',
            },
            code: {
              color: 'var(--text-primary)',
            },
            figcaption: {
              color: 'var(--text-secondary)',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  safelist: [
    'bg-primary/30',
    'bg-primary/50',
    'bg-primary/70',
    'bg-white/5',
    'bg-white/10',
    'bg-white/20',
    'bg-gray-900/70',
    'border-white/10',
    'border-primary/50',
    'border-white/5',
    {
      pattern: /(bg|text|border)-(primary|secondary|accent|success|error|warning|info)(\/\d+)?/,
      variants: ['hover', 'focus', 'active'],
    },
    {
      pattern: /(bg|text|border)-(white|black|gray-\d+)(\/\d+)?/,
      variants: ['hover', 'focus', 'active'],
    },
  ],
}; 