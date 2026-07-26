import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  // Registers animate-in/fade-in/zoom-in-*/slide-in-from-*/duration-* utilities.
  // Without this, every animate-in usage across the app (modals, cards, pickers)
  // was a dead class name -- Tailwind's JIT never generated CSS for it, which is
  // why the design review found "zero motion, anywhere" despite the markup
  // already trying to animate dozens of surfaces.
  plugins: [tailwindcssAnimate],
}