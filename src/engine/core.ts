/**
 * The monthly simulation core of the v1 engine.
 *
 * Every function here is marked 'worklet' and takes only plain data, so the same code runs on the
 * JS thread (single-line path for live sliders) and on a background worklet runtime (Monte Carlo).
 * Outside a Reanimated/Worklets babel build the directive is an inert string, so Jest runs it as-is.
 *
 * Class index order everywhere in this file: 0 cash, 1 debt, 2 Indian equity, 3 global equity, 4 gold.
 */

export const CLASS_INDEX = { cash: 0, debt: 1, indianEquity: 2, globalEquity: 3, gold: 4 } as const;
export const N_CLASSES = 5;

/** [equity, debt, gold, cash] fractions per risk profile (01-PRODUCT.md, illustrative defaults). */
export const PROFILE_MIX = {
  safetyFirst: [0.2, 0.65, 0.1, 0.05],
  cautious: [0.4, 0.45, 0.1, 0.05],
  balanced: [0.6, 0.28, 0.1, 0.02],
  growth: [0.75, 0.15, 0.08, 0.02],
  aggressive: [0.85, 0.07, 0.08, 0.0],
} as const;

/** Share of equity that goes global. Higher profiles allow more, up to 25%. */
export const GLOBAL_SHARE_OF_EQUITY = {
  safetyFirst: 0.1,
  cautious: 0.15,
  balanced: 0.25,
  growth: 0.25,
  aggressive: 0.25,
} as const;

/** Horizon caps on equity (01-PRODUCT.md). */
export function equityCap(yearsLeft: number, profileEquity: number): number {
  'worklet';
  if (yearsLeft < 3) return Math.min(profileEquity, 0.2);
  if (yearsLeft < 5) return Math.min(profileEquity, 0.4);
  if (yearsLeft < 7) return Math.min(profileEquity, 0.6);
  return profileEquity;
}

/**
 * Target class weights for a goal with `yearsLeft` to go. Equity above the horizon cap moves to debt.
 * mix = [equity, debt, gold, cash]. Returns weights in class index order.
 */
export function targetWeights(mix: readonly number[], globalShare: number, yearsLeft: number): number[] {
  'worklet';
  const eq = equityCap(yearsLeft, mix[0]);
  const debt = mix[1] + (mix[0] - eq);
  return [mix[3], debt, eq * (1 - globalShare), eq * globalShare, mix[2]];
}

export function monthlyRate(annualFraction: number): number {
  'worklet';
  return Math.pow(1 + annualFraction, 1 / 12) - 1;
}

export type SimSpec = {
  /** Starting balance per class. */
  start: number[];
  /** Months from today to the goal date. */
  months: number;
  /** Extra months simulated after the date, to find when a late goal is reached. */
  extraMonths: number;
  /** Goal-step monthly amount in month 0. */
  monthly: number;
  /** Yearly raise on the goal-step amount, as a fraction. */
  stepUp: number;
  /** Fixed monthly flows into this goal (commitments like PPF), length ≥ months + extraMonths. */
  fixed: number[];
  /** Class the fixed flows land in. */
  fixedClass: number;
  /** Profile mix [equity, debt, gold, cash]. */
  mix: number[];
  globalShare: number;
  /** Expected yearly return per class, as fractions. */
  ret: number[];
  /** Yearly volatility per class, as fractions. */
  vol: number[];
  targetToday: number;
  /** Goal inflation, as a fraction. */
  infl: number;
  /**
   * Optional per-year return overrides (Replay 2008/2020): rows of yearly returns per class,
   * applied from month 0 for as many years as given.
   */
  replay?: number[][];
};

/** Puts `c` into the balances, filling the gap to target weights first, then by weight. Never sells. */
export function allocate(bal: number[], c: number, w: number[], scratch?: number[]): void {
  'worklet';
  let total = c;
  for (let k = 0; k < N_CLASSES; k++) total += bal[k];
  let G = 0;
  const gaps = scratch ?? [0, 0, 0, 0, 0];
  for (let k = 0; k < N_CLASSES; k++) {
    gaps[k] = Math.max(0, w[k] * total - bal[k]);
    G += gaps[k];
  }
  for (let k = 0; k < N_CLASSES; k++) {
    const a = G >= c ? (G > 0 ? (c * gaps[k]) / G : 0) : gaps[k] + (c - G) * w[k];
    bal[k] += a;
  }
}

export function contributionAt(spec: SimSpec, m: number, monthly: number): number {
  'worklet';
  return monthly * Math.pow(1 + spec.stepUp, Math.floor(m / 12));
}

export function targetNominalAt(spec: SimSpec, m: number): number {
  'worklet';
  return spec.targetToday * Math.pow(1 + spec.infl, m / 12);
}

export type DetResult = {
  /** Nominal total at the end of each month (length months + extraMonths). */
  path: number[];
  /** Nominal total at the goal date. */
  final: number;
  /** First month (0-based, end of month) the total reaches the inflated target, or -1. */
  cross: number;
  /** Balance per class at the goal date. */
  atDate: number[];
};

/** Single-line (likely) projection. Fast path for sliders. */
export function simulateDeterministic(spec: SimSpec, monthlyOverride?: number, withExtra = true): DetResult {
  'worklet';
  const monthly = monthlyOverride ?? spec.monthly;
  const bal = spec.start.slice();
  const rates = [0, 0, 0, 0, 0];
  for (let k = 0; k < N_CLASSES; k++) rates[k] = monthlyRate(spec.ret[k]);
  const H = spec.months + (withExtra ? spec.extraMonths : 0);
  const path: number[] = new Array(H);
  let cross = -1;
  let final = 0;
  let atDate = bal.slice();
  for (let m = 0; m < H; m++) {
    const w = targetWeights(spec.mix, spec.globalShare, Math.max(0, (spec.months - m) / 12));
    allocate(bal, contributionAt(spec, m, monthly), w);
    if (spec.fixed[m]) bal[spec.fixedClass] += spec.fixed[m];
    const year = Math.floor(m / 12);
    const rp = spec.replay && year < spec.replay.length ? spec.replay[year] : null;
    let tot = 0;
    for (let k = 0; k < N_CLASSES; k++) {
      bal[k] *= 1 + (rp ? monthlyRate(rp[k]) : rates[k]);
      tot += bal[k];
    }
    path[m] = tot;
    if (cross < 0 && tot >= targetNominalAt(spec, m + 1)) cross = m;
    if (m === spec.months - 1) {
      final = tot;
      atDate = bal.slice();
    }
  }
  if (spec.months === 0) {
    for (let k = 0; k < N_CLASSES; k++) final += bal[k];
  }
  return { path, final, cross, atDate };
}

/**
 * Exact monthly amount that gets the likely path to the target (bisection, 36 steps over ₹0–₹50 L).
 * Callers round it up to ₹500 for display; the affordability cushion uses the exact value.
 */
export function requiredMonthlyExact(spec: SimSpec): number | null {
  'worklet';
  const target = targetNominalAt(spec, spec.months);
  const ok = (s: number) => simulateDeterministic(spec, s, false).final >= target;
  if (ok(0)) return 0;
  const HI = 5000000;
  if (!ok(HI)) return null;
  let lo = 0;
  let hi = HI;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function roundUp500(v: number): number {
  'worklet';
  return Math.ceil(v / 500) * 500;
}

// ---------- Seeded randomness ----------

/** mulberry32: small, fast, seeded PRNG. Returns a stateful generator in [0, 1). */
export function makeRng(seed: number): () => number {
  'worklet';
  let a = seed >>> 0;
  return () => {
    'worklet';
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lower-triangular Cholesky factor of a symmetric positive-definite n×n matrix (row-major). */
export function cholesky(a: number[], n: number): number[] {
  'worklet';
  const L = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      L[i * n + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j * n + j];
    }
  }
  return L;
}

/** Class correlation matrix (cash, debt, IN equity, global equity, gold). Illustrative. */
export const CORRELATION = [
  1, 0.2, 0, 0, 0,
  0.2, 1, 0.1, 0.05, 0.1,
  0, 0.1, 1, 0.6, -0.1,
  0, 0.05, 0.6, 1, 0.05,
  0, 0.1, -0.1, 0.05, 1,
];

export type McResult = {
  /** Today's-rupee value at the goal date: [p10, p50, p90]. */
  atDateToday: [number, number, number];
  /** Months (0-based) the target is reached: [p10 (early, possible), p50, p90 (late, almost sure)], -1 if not. */
  crossMonths: [number, number, number];
  /** Months (0-based) at which the percentile paths below are sampled (every `MC_SAMPLE_EVERY` months, plus the goal month). */
  sampleMonths: number[];
  /** Nominal percentile paths at `sampleMonths`: p10, p50, p90. */
  p10: number[];
  p50: number[];
  p90: number[];
  /** Share of paths that reach the target by the date. */
  successRate: number;
};

function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  'worklet';
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Monte Carlo ranges. Monthly log-returns per class are normal with median equal to the expected
 * return (so the 50th percentile matches the single line), correlated through `chol`.
 */
export const MC_SAMPLE_EVERY = 3;

export function simulateMonteCarlo(spec: SimSpec, paths: number, seed: number, chol: number[]): McResult {
  'worklet';
  const rnd = makeRng(seed);
  const H = spec.months + spec.extraMonths;
  const mu = [0, 0, 0, 0, 0];
  const sig = [0, 0, 0, 0, 0];
  for (let k = 0; k < N_CLASSES; k++) {
    mu[k] = Math.log(1 + spec.ret[k]) / 12;
    sig[k] = spec.vol[k] / Math.sqrt(12);
  }
  const weightsByMonth: number[][] = new Array(H);
  const contrib: number[] = new Array(H);
  const targets: number[] = new Array(H);
  const replayGrowth: (number[] | null)[] = new Array(H);
  for (let m = 0; m < H; m++) {
    weightsByMonth[m] = targetWeights(spec.mix, spec.globalShare, Math.max(0, (spec.months - m) / 12));
    contrib[m] = contributionAt(spec, m, spec.monthly);
    targets[m] = targetNominalAt(spec, m + 1);
    const year = Math.floor(m / 12);
    const rp = spec.replay && year < spec.replay.length ? spec.replay[year] : null;
    replayGrowth[m] = rp ? rp.map((r) => Math.pow(1 + r, 1 / 12)) : null;
  }
  // Sample months for the percentile paths: every few months, plus the goal month.
  const sampleMonths: number[] = [];
  const sampleSlot: number[] = new Array(H).fill(-1);
  for (let m = 0; m < H; m++) {
    if (m % MC_SAMPLE_EVERY === MC_SAMPLE_EVERY - 1 || m === spec.months - 1 || m === H - 1) {
      sampleSlot[m] = sampleMonths.length;
      sampleMonths.push(m);
    }
  }
  const S = sampleMonths.length;
  const samples = new Float64Array(S * paths);
  const finals = new Float64Array(paths);
  const crosses = new Float64Array(paths);
  const z = [0, 0, 0, 0, 0];
  const gaps = [0, 0, 0, 0, 0];
  const bal = [0, 0, 0, 0, 0];
  let reached = 0;
  const deflate = Math.pow(1 + spec.infl, spec.months / 12);
  const fixed = spec.fixed;
  const fc = spec.fixedClass;
  for (let p = 0; p < paths; p++) {
    for (let k = 0; k < N_CLASSES; k++) bal[k] = spec.start[k];
    let cross = -1;
    for (let m = 0; m < H; m++) {
      allocate(bal, contrib[m], weightsByMonth[m], gaps);
      if (fixed[m]) bal[fc] += fixed[m];
      const rg = replayGrowth[m];
      let tot = 0;
      if (rg) {
        for (let k = 0; k < N_CLASSES; k++) {
          bal[k] *= rg[k];
          tot += bal[k];
        }
      } else {
        for (let k = 0; k < N_CLASSES; k += 2) {
          // Box–Muller gives two independent normals per pair of uniforms.
          const u1 = Math.max(rnd(), 1e-12);
          const u2 = rnd();
          const r = Math.sqrt(-2 * Math.log(u1));
          z[k] = r * Math.cos(2 * Math.PI * u2);
          if (k + 1 < N_CLASSES) z[k + 1] = r * Math.sin(2 * Math.PI * u2);
        }
        for (let i = 0; i < N_CLASSES; i++) {
          let e = 0;
          for (let j = 0; j <= i; j++) e += chol[i * N_CLASSES + j] * z[j];
          bal[i] *= Math.exp(mu[i] + sig[i] * e);
          tot += bal[i];
        }
      }
      const slot = sampleSlot[m];
      if (slot >= 0) samples[slot * paths + p] = tot;
      if (cross < 0 && tot >= targets[m]) cross = m;
      if (m === spec.months - 1) finals[p] = tot / deflate;
    }
    if (spec.months === 0) {
      let tot = 0;
      for (let k = 0; k < N_CLASSES; k++) tot += bal[k];
      finals[p] = tot;
    }
    crosses[p] = cross < 0 ? 1e9 : cross;
    if (cross >= 0 && cross <= spec.months - 1) reached++;
  }
  finals.sort();
  crosses.sort();
  const p10: number[] = new Array(S);
  const p50: number[] = new Array(S);
  const p90: number[] = new Array(S);
  for (let s = 0; s < S; s++) {
    const col = samples.subarray(s * paths, (s + 1) * paths);
    col.sort();
    p10[s] = quantileSorted(col, 0.1);
    p50[s] = quantileSorted(col, 0.5);
    p90[s] = quantileSorted(col, 0.9);
  }
  const cq = (q: number) => {
    const v = crosses[Math.min(paths - 1, Math.floor((paths - 1) * q))];
    return v >= 1e9 ? -1 : v;
  };
  return {
    atDateToday: [quantileSorted(finals, 0.1), quantileSorted(finals, 0.5), quantileSorted(finals, 0.9)],
    crossMonths: [cq(0.1), cq(0.5), cq(0.9)],
    sampleMonths,
    p10,
    p50,
    p90,
    successRate: reached / paths,
  };
}
