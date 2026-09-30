import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#070b14",
        panel: "#0d1322",
        edge: "#1e2a45",
        neon: "#22d3ee",
      },
      fontFamily: {
        arcade: ["'Chakra Petch', 'Space Grotesk', system-ui, 'sans-serif'"],
        mono2: ["'JetBrains Mono', ui-monospace, monospace"],
      },
      boxShadow: {
        glow: "0 0 18px rgba(34,211,238,0.35)",
        block: "inset 0 0 0 1px rgba(255,255,255,0.22), inset -2px -2px 0 rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
