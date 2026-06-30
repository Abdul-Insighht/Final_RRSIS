/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#32a45a",
        "primary-hover": "#288749",
        "secondary": "#00c9a7",
        "background-light": "#f6f8f7",
        "background-dark": "#0A1C14",
        "surface-dark": "#142C22",
        "panel-dark": "#1D271D",
        "input-bg-dark": "#152015",
        "border-dark": "#2b362f",
        "text-secondary": "#94a3b8",
        "text-muted": "#a2b4a8",
        "sky-blue": "#38bdf8",
        // Segmentation overlay colors
        "segment-roads": "#FFD93D",
        "segment-water": "#4D96FF",
        "segment-veg": "#38B000",
        "segment-build": "#FF6B6B",
        "segment-barren": "#CDB4DB",
        // Status colors
        "status-pending": "#ffc107",
        "status-failed": "#ef4444",
        "status-success": "#22c55e",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "DEFAULT": "0.375rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "full": "9999px"
      },
    },
  },
  plugins: [],
}
