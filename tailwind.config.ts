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
          orange: "#ff5e14",
          orangeLight: "#ff7a38",
          dark: "#0e1317",
          card: "#161c22",
          cardHover: "#1d252d",
          border: "#252e37",
        },
      },
    },
  },
  plugins: [],
};
export default config;
