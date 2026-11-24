// Money Plan — "Dusk minimal" design tokens.
// Source of truth: design/html/*.dc.html (inline styles) and docs/03-DESIGN-SYSTEM.md.
// Gradients are top-to-bottom; feed `colors` + `locations` to expo-linear-gradient or a Skia <LinearGradient>.

export const gradients = {
  // Default screen background (Home, Goals, Payday flow).
  dusk: { colors: ['#07060D', '#110A30', '#3A1D7A', '#A3363A', '#F2741C'], locations: [0, 0.3, 0.55, 0.76, 1] },
  // Celebration and payday moments (Payday, Receipt, Level up, Milestone).
  ember: { colors: ['#0C0724', '#2E1767', '#8A2A4E', '#DA4E16', '#FF9A2E'], locations: [0, 0.26, 0.52, 0.78, 1] },
  // Calm, data-heavy screens (Holdings, Assumptions, Privacy, sheets).
  night: { colors: ['#07060D', '#0E0A24', '#1B1240'], locations: [0, 0.6, 1] },
  // Sandbox and wealth (What if, Net worth, Mix check).
  sky: { colors: ['#07060D', '#0A1A4A', '#1747B8', '#3DA0FF'], locations: [0, 0.34, 0.72, 1] },
  // Habits and learning (Levels, Collection, Streak, Money minute).
  violet: { colors: ['#07060D', '#140C3A', '#3A1D7A', '#6B3FC0'], locations: [0, 0.42, 0.78, 1] },
  // Settings and secondary lists.
  dim: { colors: ['#07060D', '#110A30', '#2A1660'], locations: [0, 0.4, 1] },
} as const;

export const colors = {
  white: '#FFFFFF',
  ink: '#14080A', // text on the white pill button
  text: '#FFFFFF',
  textBody: 'rgba(255,255,255,0.68)',
  textCaption: 'rgba(255,255,255,0.60)',
  textGhost: 'rgba(255,255,255,0.85)',
  navIdle: 'rgba(255,255,255,0.55)',
  track: 'rgba(255,255,255,0.14)',
  hairline: 'rgba(255,255,255,0.12)',
  glass: 'rgba(255,255,255,0.08)', // card / sheet surfaces on gradients
  glassStrong: 'rgba(255,255,255,0.14)',
  scrim: 'rgba(7,6,13,0.6)',

  // Status words
  comfortable: '#3BE08A',
  manageable: '#FFFFFF',
  stretch: '#FFC83D', // amber — also "needs attention"
  short: '#FF8A4C',
  lavender: '#C9C3FF', // secondary accent text on violet screens

  // Asset classes (bubbles, mix bars, timeline stacks)
  cash: '#9AA0AA',
  debt: '#12B8AA',
  indianEquity: '#19C463',
  globalEquity: '#1E6BFF',
  gold: '#FFC83D',
  other: '#A66BFF',

  // Goal accents used on Payday bubbles and rings (assign in goal order)
  goal: ['#FF8A3D', '#12B8AA', '#FFC83D', '#8B7CF6', '#2EE6D6', '#FF4FA3'],
} as const;

export const gullu = {
  ink: '#14080A',
  deep: '#7A1F08',
  slot: '#3A0F05',
  cheeks: '#FF6FA0',
  aura: '#8B7CF6',
  coin: { fill: '#FFC83D', stroke: '#C98A00', text: '#8A5A00' },
  skins: {
    base: { body: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], band: '#FFE7C2' },
    steady: { body: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], band: '#7FF0E0' },
    secure: { body: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], band: '#FFD25A', rim: true },
    builder: { body: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], band: '#FFD25A', rim: true, flowers: true },
    halfway: { body: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], band: '#FFD25A', rim: true, zigzag: true },
    free: { body: ['#FFE6A0', '#F2B23A', '#C27A12', '#8A520A'], band: '#FFF6D6', rim: true, flowers: true, zigzag: true },
    diwali: { body: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], band: '#FFD25A', rim: true, diya: true, flowers: true },
    holi: { body: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], band: '#FFFFFF', splashes: true },
  },
} as const;

export const font = {
  family: 'Inter', // bundle via @expo-google-fonts/inter — the app is offline, never load fonts from the network
  weights: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
  numeric: { fontVariant: ['tabular-nums'] as const },
} as const;

// Two text sizes per screen is the rule; these are the only styles.
export const type = {
  big: { fontSize: 52, lineHeight: 56, fontWeight: '800', letterSpacing: -2.08 }, // hero amount
  h1: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.02 }, // one message per screen
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '700' }, // buttons
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const layout = {
  frame: { width: 390, height: 844 }, // design frame (iPhone 14/15/16)
  screenPadding: { top: 30, horizontal: 24, bottom: 24 },
  rowMinHeight: 60,
  hitTarget: 44,
} as const;
export const radius = { sm: 12, md: 20, lg: 28, pill: 999 } as const;

export const components = {
  primaryButton: { height: 58, radius: 999, bg: '#FFFFFF', fg: '#14080A' },
  ghostButton: { minHeight: 44, fg: 'rgba(255,255,255,0.85)' },
  pill: { height: 40, paddingH: 16, radius: 999, on: { bg: '#FFFFFF', fg: '#14080A' } },
  navIcon: { size: 52, icon: 22, strokeWidth: 1.9 },
  dot: 10,
  track: { height: 4, radius: 2 },
} as const;
