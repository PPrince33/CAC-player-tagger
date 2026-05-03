/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      colors: {
        neon: '#34D399',
        brutal: {
          yellow: '#FACC15',
          bg:     '#F9FAFB',
        },
      },
      boxShadow: {
        brutal:    '4px 4px 0px 0px rgba(0,0,0,1)',
        'brutal-sm':'3px 3px 0px 0px rgba(0,0,0,1)',
        'brutal-lg':'6px 6px 0px 0px rgba(0,0,0,1)',
      },
      borderWidth: { 3: '3px' },
      transitionProperty: { none: 'none' },
    },
  },
  plugins: [],
};
