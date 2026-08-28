const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        red: colors.red,
        slate: colors.slate,
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
