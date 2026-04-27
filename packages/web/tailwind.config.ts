import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark, warm-tinted black. Not pure black — feels softer on the eyes.
        bg: {
          DEFAULT: '#09090B',
          elev: '#0E0E10',
          sub: '#111114',
        },
        ink: {
          DEFAULT: '#EDEDEF',
          muted: '#8E8E95',
          faint: '#52525A',
          ghost: '#2A2A2F',
        },
        line: {
          DEFAULT: '#1C1C21',
          strong: '#27272C',
        },
        accent: {
          DEFAULT: '#A78BFA',
          soft: '#191527',
          deep: '#6D55C6',
        },
        positive: '#6EE7B7',
        warn: '#E0B455',
        negative: '#FB7185',
        series: {
          vault: '#A78BFA',
          lp: '#E0B455',
          taker: '#7DD3FC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        '3xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.08em' }],
      },
      letterSpacing: {
        wider: '0.06em',
        widest: '0.14em',
      },
    },
  },
  plugins: [],
} satisfies Config;
