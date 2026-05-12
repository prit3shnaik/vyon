/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        card: "#0d0d0d",
        border: "#1e1e1e",
        cyan: { DEFAULT: "#00ffff", dim: "#00cccc", glow: "rgba(0,255,255,0.12)" },
        magenta: { DEFAULT: "#ff00ff", dim: "#cc00cc" },
        severity: {
          critical: "#ff2d55",
          high: "#ff6b35",
          medium: "#ffd60a",
          low: "#34c759",
          info: "#636366",
        },
      },
      fontFamily: {
        mono: ["'Fira Code'", "monospace"],
        display: ["'Orbitron'", "monospace"],
        body: ["'Rajdhani'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
