import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        available: {
          bg: "#052e16",
          border: "#16a34a",
          text: "#4ade80",
        },
        taken: {
          bg: "#450a0a",
          border: "#dc2626",
          text: "#f87171",
        },
        unknown: {
          bg: "#1c1917",
          border: "#57534e",
          text: "#a8a29e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
