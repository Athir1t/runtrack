import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kmutt: {
          orange: "rgb(var(--kmutt-orange) / <alpha-value>)",
          orangeLight: "rgb(var(--kmutt-orange-light) / <alpha-value>)",
          dark: "rgb(var(--kmutt-dark) / <alpha-value>)",
          card: "rgb(var(--kmutt-card) / <alpha-value>)",
          cardHover: "rgb(var(--kmutt-card-hover) / <alpha-value>)",
          border: "rgb(var(--kmutt-border) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
