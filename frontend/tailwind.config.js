/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Quiet, clinical palette — this is a trust/audit product, not a
        // marketing page. Deep ink + a single desaturated verify-blue accent.
        ink: {
          950: "#0B0E14",
          900: "#12161F",
          800: "#1B212C",
          700: "#2A3140",
          500: "#5B6472",
          300: "#9AA3B2",
          100: "#E7E9ED",
          50: "#F7F8FA",
        },
        verify: {
          600: "#2D5FE0",
          500: "#4472F0",
          100: "#E5ECFE",
        },
        flag: {
          600: "#C24418",
          100: "#FBE7DC",
        },
      },
      fontFamily: {
        display: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular"],
      },
    },
  },
  plugins: [],
};
