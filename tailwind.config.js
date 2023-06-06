/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Block & Lot palette: color only where it means something.
        ink: { DEFAULT: '#14171c', 2: '#474d57', 3: '#676d77' },
        paper: { DEFAULT: '#ffffff', 2: '#f3f4f6' },
        rule: '#dadde2',
        control: '#858b94',
        select: { DEFAULT: '#2150d0', wash: '#eaf0fd' },
        stale: { DEFAULT: '#8a5300', wash: '#fbf3e2' },
        // Change classes are a data legend shared with the core pipeline. Never restyle.
        change: { added: '#00c83c', demolished: '#dc1e1e', modified: '#ffc800', unchanged: '#8c8c8c' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        cond: ['var(--font-cond)', 'Arial Narrow', 'var(--font-sans)', 'sans-serif'],
      },
      boxShadow: {
        // The only shadow: things that float over the map.
        float: '0 6px 24px rgba(20, 23, 28, 0.14)',
        panel: '0 6px 24px rgba(20, 23, 28, 0.14)',
      },
    },
  },
  plugins: [],
};
