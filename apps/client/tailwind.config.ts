import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ブランドカラー（プロフェッショナル・コーポレートデザイン）
        primary: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d8ff',
          300: '#a4bcfd',
          400: '#8098fb',
          500: '#6174f5',
          600: '#4f5bea',
          700: '#4148d1',
          800: '#363ca9',
          900: '#303785',
          950: '#1d2050',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans JP',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: {
        content: '72rem',
      },
    },
  },
  plugins: [],
}

export default config
