/**
 * Gullu's geometry, ported part by part from reference/gullu.js (240×240 viewBox).
 * Pure data: the Skia component turns these into animatable parts.
 */
import { gullu as tokens } from '../theme/tokens';

export type Expression = 'happy' | 'wave' | 'think' | 'celebrate' | 'sleepy' | 'concern' | 'catch';
export type Skin = keyof typeof tokens.skins;
export const EXPRESSIONS: Expression[] = ['happy', 'wave', 'think', 'celebrate', 'sleepy', 'concern', 'catch'];
export const SKINS: Skin[] = ['base', 'steady', 'secure', 'builder', 'halfway', 'free', 'diwali', 'holi'];

export const INK = tokens.ink;
export const DEEP = tokens.deep;
export const SLOT = tokens.slot;
export const CHEEK = tokens.cheeks;

/** The ground point squash/stretch happens around (bottom of the body). */
export const GROUND = { x: 120, y: 214 };
export const SLOT_POS = { x: 120, y: 78 };

export const BODY_PATH = 'M120 58 C78 58, 40 98, 40 142 C40 188, 76 214, 120 214 C164 214, 200 188, 200 142 C200 98, 162 58, 120 58 Z';
export const BAND_PATH = 'M56 180 Q120 200 184 180';
export const BEADS = [76, 92, 108, 124, 140, 156].map((x, i) => ({ x: x + 4, y: 190 + (i === 0 || i === 5 ? -3 : 0) }));

/** Arm poses as quadratic curves [x0, y0, cx, cy, x1, y1]. */
export type ArmPose = 'up' | 'down' | 'chin' | 'side';
export const ARM_L: Record<ArmPose, number[]> = {
  up: [46, 138, 26, 116, 32, 92],
  down: [44, 150, 28, 158, 32, 174],
  chin: [44, 150, 28, 158, 32, 174],
  side: [44, 146, 22, 140, 18, 120],
};
export const ARM_R: Record<ArmPose, number[]> = {
  up: [194, 138, 214, 116, 208, 92],
  down: [196, 150, 212, 158, 208, 174],
  chin: [192, 162, 172, 182, 152, 174],
  side: [196, 146, 218, 140, 222, 120],
};
export const ARMS: Record<Expression, [ArmPose, ArmPose]> = {
  happy: ['down', 'down'],
  wave: ['down', 'up'],
  think: ['down', 'chin'],
  celebrate: ['up', 'up'],
  sleepy: ['down', 'down'],
  concern: ['down', 'down'],
  catch: ['side', 'side'],
};

/** Where the pupils sit per expression (left, right). Celebrate and sleepy have closed eyes. */
export const PUPILS: Partial<Record<Expression, [[number, number], [number, number]]>> = {
  happy: [[99, 137], [143, 137]],
  wave: [[99, 137], [143, 137]],
  think: [[103, 129], [147, 129]],
  concern: [[99, 140], [141, 140]],
  catch: [[99, 128], [143, 128]],
};

export const MOUTH: Record<Expression, { d: string; fill?: string; stroke?: string }> = {
  happy: { d: 'M107 160 Q120 173 133 160', stroke: SLOT },
  wave: { d: 'M107 160 Q120 173 133 160', stroke: SLOT },
  think: { d: 'M112 163 Q120 159 128 163', stroke: SLOT },
  celebrate: { d: 'M103 155 Q120 184 137 155 Z', fill: SLOT },
  sleepy: { d: 'M124.5 162 a4.5 4.5 0 1 0 -9 0 a4.5 4.5 0 1 0 9 0', fill: SLOT },
  concern: { d: 'M106 165 Q113 158 120 165 Q127 172 134 165', stroke: SLOT },
  catch: { d: 'M128 163 a8 9 0 1 0 -16 0 a8 9 0 1 0 16 0', fill: SLOT },
};

export const CLOSED_EYES: Partial<Record<Expression, string[]>> = {
  celebrate: ['M86 138 Q98 124 110 138', 'M130 138 Q142 124 154 138'],
  sleepy: ['M86 136 Q98 144 110 136', 'M130 136 Q142 144 154 136'],
};
export const CONCERN_BROWS = ['M84 114 L108 122', 'M156 114 L132 122'];
export const SWEAT_DROP = 'M182 92 Q174 108 182 114 Q190 108 182 92 Z';
export const THINK_BUBBLES = [
  { x: 194, y: 74, r: 5 },
  { x: 208, y: 56, r: 7 },
  { x: 224, y: 34, r: 10 },
];
export const CELEBRATE_COINS = [
  { x: 34, y: 66, r: 13 },
  { x: 206, y: 52, r: 11 },
  { x: 222, y: 112, r: 8 },
];
export const CELEBRATE_SPARKS = ['M28 112 l-10 -4', 'M30 124 l-12 4', 'M184 30 l4 -10', 'M196 34 l10 -6'];
/** A "z" drawn as a path (no font needed). */
export const zPath = (x: number, y: number, s: number) => `M${x} ${y - s * 0.7} h${s * 0.62} l${-s * 0.62} ${s * 0.7} h${s * 0.62}`;
export const SLEEPY_Z = [
  { x: 176, y: 84, s: 22 },
  { x: 196, y: 62, s: 16 },
  { x: 210, y: 44, s: 12 },
];

// ---------- Skin extras ----------
export const RIM = { lid: { cx: 120, cy: 57, rx: 19, ry: 7 }, knob: { cx: 120, cy: 45, r: 10 }, color: '#FFC83D' };
export const flower = (cx: number, cy: number) => ({
  petals: [0, 72, 144, 216, 288].map((a) => ({ x: cx + 6 * Math.cos((a * Math.PI) / 180), y: cy + 6 * Math.sin((a * Math.PI) / 180) })),
  centre: { x: cx, y: cy },
});
export const BUILDER_FLOWERS = [flower(66, 150), flower(174, 150)];
export const DIWALI_FLOWERS = [flower(70, 158), flower(170, 158)];
export const ZIGZAG = 'M62 168 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8';
export const DIYA_OUTER = 'M120 10 C112 22 112 30 120 34 C128 30 128 22 120 10 Z';
export const DIYA_INNER = 'M120 18 C116 25 116 29 120 31 C124 29 124 25 120 18 Z';
export const HOLI_SPLASHES = [
  { x: 72, y: 120, r: 13, c: '#FF4FA3', o: 0.75 },
  { x: 170, y: 112, r: 11, c: '#3BE08A', o: 0.75 },
  { x: 150, y: 180, r: 10, c: '#4C7DFF', o: 0.75 },
  { x: 96, y: 88, r: 7, c: '#FFD25A', o: 0.85 },
];

export const skinHas = (skin: Skin) => {
  const s = tokens.skins[skin] as { rim?: boolean; flowers?: boolean; zigzag?: boolean; diya?: boolean; splashes?: boolean };
  return {
    rim: !!s.rim,
    flowers: !!s.flowers && skin !== 'diwali',
    diwaliFlowers: skin === 'diwali',
    zigzag: !!s.zigzag,
    diya: !!s.diya,
    splashes: !!s.splashes,
  };
};
export const skinBody = (skin: Skin) => [...tokens.skins[skin].body];
export const skinBand = (skin: Skin) => tokens.skins[skin].band;
