/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Haylingua brand — Armenian apricot (ծիրան). Primary action color.
        brand: {
          50: "#FFF5EC",
          100: "#FFE7D2",
          200: "#FFC99E",
          300: "#FFAB6B",
          400: "#FF9342",
          500: "#FF7A1A", // primary
          600: "#E85F00",
          700: "#B84B00", // pressed / 3D shadow edge
          800: "#8F3B00",
          900: "#6B2C00",
        },
        // Pomegranate (նուռ) — warm secondary accent.
        pom: {
          50: "#FDECEF",
          100: "#FAD1D9",
          400: "#EF476F",
          500: "#E11D48",
          600: "#B71540",
          700: "#8F1033",
        },
        // Success — Duolingo-like grass green.
        grass: {
          50: "#EFFCE3",
          100: "#D7F5BA",
          400: "#7CE246",
          500: "#58CC02",
          600: "#46A302",
          700: "#3A8A00",
        },
        // Wrong / danger.
        cardinal: {
          50: "#FFECEC",
          100: "#FFD1D1",
          400: "#FF6B6B",
          500: "#FF4B4B",
          600: "#E63232",
          700: "#C81E1E",
        },
        // Feather blue — info / listening / locked-glow accent.
        feather: {
          50: "#E7F7FF",
          100: "#C5ECFF",
          400: "#4EC2FF",
          500: "#1CB0F6",
          600: "#1899D6",
          700: "#147BB0",
        },
        // Streak / XP gold.
        gold: {
          50: "#FFF8E1",
          100: "#FFEFB8",
          400: "#FFD43B",
          500: "#FFC800",
          600: "#E0A800",
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', '"Nunito"', "ui-rounded", "system-ui", "sans-serif"],
        sans: ['"Nunito"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // 3D "pressable" button edges.
        "btn-brand": "0 4px 0 0 #B84B00",
        "btn-grass": "0 4px 0 0 #3A8A00",
        "btn-neutral": "0 4px 0 0 #CBD5E1",
        "btn-cardinal": "0 4px 0 0 #C81E1E",
        "btn-feather": "0 4px 0 0 #147BB0",
        "node": "0 6px 0 0 rgba(0,0,0,0.12)",
        "node-grass": "0 6px 0 0 #3A8A00",
        "node-brand": "0 6px 0 0 #B84B00",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.06)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        bouncey: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        wiggle: {
          "0%,100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%,60%": { transform: "translateX(-7px)" },
          "40%,80%": { transform: "translateX(7px)" },
        },
        ringPulse: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
        confettiFall: {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(720deg)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 220ms ease-out both",
        bouncey: "bouncey 1.4s ease-in-out infinite",
        floaty: "floaty 3s ease-in-out infinite",
        wiggle: "wiggle 600ms ease-in-out",
        shake: "shake 420ms ease-in-out",
        ringPulse: "ringPulse 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};
