import type { Config } from "tailwindcss"

const config = {
  darkMode: false,
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
      },
      backgroundColor: {
        Page: "#f0fdfb",
        sidebar: "#ccfbf1",
      },
      boxShadow: {
        DEFAULT: "0 1px 3px 0 rgba(20, 184, 166, 0.08)",
        md: "0 4px 6px -1px rgba(20, 184, 166, 0.1)",
        lg: "0 10px 15px -3px rgba(20, 184, 166, 0.1)",
      },
      borderRadius: {
        "2xl": "16px",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config
