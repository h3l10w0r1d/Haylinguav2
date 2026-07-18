/** @type {import('tailwindcss').Config} */
// Brand color tokens ported from the web app's tailwind.config.cjs — keep
// these two files in sync when the palette changes. Shadows/keyframes are
// NOT ported: RN has no CSS box-shadow or @keyframes; those are handled via
// native shadow props / the Animated API directly in components instead.
module.exports = {
  content: ["./App.js", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF5EC",
          100: "#FFE7D2",
          200: "#FFC99E",
          300: "#FFAB6B",
          400: "#FF9342",
          500: "#FF7A1A",
          600: "#E85F00",
          700: "#B84B00",
          800: "#8F3B00",
          900: "#6B2C00",
        },
        pom: {
          50: "#FDECEF",
          100: "#FAD1D9",
          400: "#EF476F",
          500: "#E11D48",
          600: "#B71540",
          700: "#8F1033",
        },
        grass: {
          50: "#EFFCE3",
          100: "#D7F5BA",
          300: "#A5E86B",
          400: "#7CE246",
          500: "#58CC02",
          600: "#46A302",
          700: "#3A8A00",
        },
        cardinal: {
          50: "#FFECEC",
          100: "#FFD1D1",
          300: "#FF9B9B",
          400: "#FF6B6B",
          500: "#FF4B4B",
          600: "#E63232",
          700: "#C81E1E",
        },
        feather: {
          50: "#E7F7FF",
          100: "#C5ECFF",
          300: "#8AD6FF",
          400: "#4EC2FF",
          500: "#1CB0F6",
          600: "#1899D6",
          700: "#147BB0",
        },
        gold: {
          50: "#FFF8E1",
          100: "#FFEFB8",
          300: "#FFE066",
          400: "#FFD43B",
          500: "#FFC800",
          600: "#E0A800",
        },
      },
      fontFamily: {
        // Bundled via src/assets/fonts + react-native.config.js (asset linking).
        display: ["BalooTwo-ExtraBold"],
        sans: ["Nunito-Regular"],
        "sans-bold": ["Nunito-Bold"],
        "sans-extrabold": ["Nunito-ExtraBold"],
      },
    },
  },
  plugins: [],
};
