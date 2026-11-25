/**
 * 8.2 Assumptions presets. Base is the plan's default (onboarding.ts defaultAssumptions); Cautious
 * and Optimistic are drafted (docs give only Base): lower or higher returns and inflation, same
 * volatility. Pure TS.
 */
import type { Assumptions } from './types';

export type Preset = Exclude<Assumptions['preset'], 'custom'>;
export const PRESET_LABEL: Record<Assumptions['preset'], string> = { cautious: 'Cautious', default: 'Base', hopeful: 'Optimistic', custom: 'Your own' };

const DELTA: Record<Preset, { equity: number; other: number; inflation: number }> = {
  cautious: { equity: -2, other: -1, inflation: 1 },
  default: { equity: 0, other: 0, inflation: 0 },
  hopeful: { equity: 1, other: 0.5, inflation: -0.5 },
};

/** A preset applied on top of the base values (keeps volatility, step-up and display settings). */
export function applyPreset(base: Assumptions, preset: Preset): Assumptions {
  const d = DELTA[preset];
  const r = base.returnPct;
  return {
    ...base,
    preset,
    inflationPct: base.inflationPct + d.inflation,
    returnPct: { ...r, indianEquity: r.indianEquity + d.equity, globalEquity: r.globalEquity + d.equity, debt: r.debt + d.other, gold: r.gold + d.other, cash: r.cash + d.other },
  };
}

/** Which preset (if any) these values match, given the base. */
export function presetOf(base: Assumptions, a: Assumptions): Assumptions['preset'] {
  for (const p of ['default', 'cautious', 'hopeful'] as Preset[]) {
    const x = applyPreset(base, p);
    if (x.inflationPct === a.inflationPct && (Object.keys(x.returnPct) as (keyof typeof x.returnPct)[]).every((k) => x.returnPct[k] === a.returnPct[k])) return p;
  }
  return 'custom';
}
