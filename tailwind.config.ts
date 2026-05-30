// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        gold: 'var(--gold)',
        blue: 'var(--blue)',
        header: 'var(--header)',
        glow: 'var(--glow)',
      },
      fontFamily: {
        pixel: ['Press Start 2P', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
