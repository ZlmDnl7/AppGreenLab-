/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#eefbf3",
          100: "#d7f5e2",
          200: "#b2ebc7",
          300: "#7edaa2",
          400: "#43c679",
          500: "#22a85b",
          600: "#178549",
          700: "#136a3d",
          800: "#115533",
          900: "#0f462c"
        }
      }
    }
  },
  plugins: []
};

