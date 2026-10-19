// Tailwind Play CDN config for the CORA prototype.
// Loaded right after https://cdn.tailwindcss.com so the CDN picks it up.
//
// Only palettes that exist in frontend/tailwind.config.js are used in the
// prototype (red, slate, emerald, amber, teal, stone, white, black), so every
// class here ports to the real app without silently generating no CSS.
// The prototype also never uses `*-20` spacing keys, because the NDL preset
// makes `-20` mean 20px in the real app (see CLAUDE.md).
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
};
