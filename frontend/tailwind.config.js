const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        red: colors.red,
        slate: colors.slate,
        // Assess marks correct answers green. Only the colors listed here are
        // generated, so omitting emerald made bg-emerald-50/border-emerald-300
        // silently produce no CSS at all.
        emerald: colors.emerald,
        amber: colors.amber,
        teal: colors.teal,
        stone: colors.stone,
        white: colors.white,
        black: colors.black,
        gray: colors.gray,
      },
    },
  },
  plugins: [],
  presets: [require('@neo4j-ndl/base').tailwindConfig],
  corePlugins: {
    preflight: false,
  },
  prefix: '',
};
