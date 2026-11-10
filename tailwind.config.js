/**
 * Los valores viven en `design.tokens.mjs` (única fuente de verdad, ver
 * `docs/diseno/ui-kit.md`). Aquí solo se conectan con Tailwind.
 */
import { tokens } from './design.tokens.mjs';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      spacing: tokens.spacing,
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      transitionTimingFunction: { brand: tokens.motion.easing },
      keyframes: tokens.keyframes,
      animation: tokens.animation,
    },
  },
  plugins: [],
}
