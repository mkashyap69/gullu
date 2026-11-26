// Motion tokens from docs/04-MOTION.md. Components use only these: no magic numbers.
import { Easing } from 'react-native-reanimated';

export const duration = {
  instant: 90, // press feedback
  fast: 160, // toggles, small fades
  base: 240, // most enters/exits
  slow: 400, // screen-level reveals
  draw: 900, // chart/ring/line draws
  calm: 1200, // market-fall line draw (deliberately slow)
  celebrate: 1600, // particles, level up
} as const;

export const easing = {
  out: Easing.bezier(0.22, 1, 0.36, 1), // enters, draws (easeOutQuint-ish)
  inOut: Easing.bezier(0.65, 0, 0.35, 1), // cross-fades, morphs
  in: Easing.bezier(0.55, 0, 1, 0.45), // exits only
} as const;

export const spring = {
  press: { damping: 18, stiffness: 420, mass: 0.6 }, // buttons, chips
  snappy: { damping: 16, stiffness: 260, mass: 0.8 }, // pills, toggles, list reorder
  bouncy: { damping: 9, stiffness: 180, mass: 0.9 }, // Gullu landing, bubbles arriving
  gentle: { damping: 20, stiffness: 120, mass: 1 }, // sheets, rings filling, layout
  float: { damping: 6, stiffness: 40, mass: 1 }, // idle bob (use with withRepeat)
} as const;

export const stagger = { list: 40, cards: 60, rings: 80 } as const;
export const distance = { enter: 12, sheet: 24 } as const; // px to translate on enter

/**
 * Derived values used by specific animations in 04-MOTION.md. They are named here so components
 * never carry raw numbers. Each one cites the line of the doc it comes from.
 */
export const gulluMotion = {
  breathePeriod: 3000, // idleBreathe: 3s loop
  breatheScale: 1.02,
  sleepyPeriod: 5000, // sleepy: slow breathe (5s)
  blinkDuration: 140, // blink: 140ms
  blinkMinGap: 3500, // every 3.5–6s
  blinkMaxGap: 6000,
  doubleBlinkChance: 0.2,
  lookMax: 4, // lookAt: pupils offset up to 4px
  landFrom: -80, // land: drop from −80px
  squashY: 0.86, // land: squash scaleY 0.86, scaleX 1.1
  squashX: 1.1,
  lidLag: 40, // lid lags 40ms
  hopHeight: -18, // hop: −18px
  spinDuration: 900, // spin: 900ms
  stretchMax: 1.15, // stretchPull: up to 1.15× tall
  waveCount: 2, // wave: twice
} as const;

export const signature = {
  bubbleGap: 80, // Payday: bubbles pop out 80ms apart
  dialTicks: 60, // Answer: 60 ticks
  dialTickGap: 15, // 15ms apart
  dialHueEnd: 135, // hue sweep 0 → 135°
  ambientDrift: 10000, // background drift 8–12s loop
  pressScale: 0.97,
  liftScale: 1.03,
  scrimOpacity: 0.6,
  particleBudget: 60,
  bubbleBobPeriod: 2800, // Payday bubbles: gentle idle bob, each on its own phase
  bubbleBobPx: 3,
  breatheGlow: 1600, // "Keep going" soft breathing glow (market fall)
  softShakePx: 5, // locked tile / wrong answer: a soft shake, never a red flash
  softShakeStep: 70,
  holdConfirm: 2000, // "Delete everything": hold-to-confirm ring
  timelinePlay: 4000, // Timeline: play runs 5 years forward in about 4s
} as const;
