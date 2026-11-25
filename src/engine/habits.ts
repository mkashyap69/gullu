/**
 * The habit layer (06-HABITS.md): payday streak with shields, levels tied to real progress,
 * festival looks. Nothing here rewards opening the app. Pure TS.
 */
import { MONTHS, ymMonth, ymYear } from './dates';
import { goalResultFast, planGoals, retirementCorpus, safetyNet } from './plan';
import type { PlanInput, YM } from './types';

// ---------- streak and shields ----------

export type StreakState = {
  streak: number;
  /** Months covered by a shield (used). */
  shielded: YM[];
  /** A shield is held, ready to cover one missed month. */
  shieldHeld: boolean;
  /** Placed months in a row needed before the next shield is earned. */
  nextShieldIn: number;
};

export const SHIELD_EVERY = 6;

/**
 * Walks every month from the first placed payday: placed months add to the streak; a missed month
 * is covered by a held shield (the streak survives), else the streak restarts. One shield is
 * earned every 6 placed months in a row, and at most one is held.
 */
export function streakState(placedMonths: YM[], usedShields: YM[], upTo: YM): StreakState {
  const placed = new Set(placedMonths);
  const used = new Set(usedShields);
  if (placed.size === 0) return { streak: 0, shielded: [], shieldHeld: false, nextShieldIn: SHIELD_EVERY };
  const first = Math.min(...placed);
  let streak = 0;
  let run = 0; // placed months since the last shield was earned or used
  let held = false;
  const shielded: YM[] = [];
  const last = Math.max(upTo, Math.max(...placed));
  for (let m = first; m <= last; m++) {
    if (placed.has(m)) {
      streak++;
      run++;
      if (!held && run >= SHIELD_EVERY) {
        held = true;
        run = 0;
      }
    } else if (m === last && !placed.has(m)) {
      // The current month isn't over: it doesn't break anything yet.
    } else if (held || used.has(m)) {
      held = false;
      run = 0;
      streak++;
      shielded.push(m);
    } else {
      streak = 0;
      run = 0;
    }
  }
  return { streak, shielded, shieldHeld: held, nextShieldIn: held ? 0 : SHIELD_EVERY - run };
}

// ---------- festivals (bundled, offline: 06-HABITS "ship 5 years of dates") ----------

/** Month of Diwali and Holi, 2026–2031 (main festival day; approximate to the month). */
export const FESTIVALS: { id: 'diwali' | 'holi'; year: number; month: number }[] = [
  { id: 'holi', year: 2026, month: 3 }, { id: 'diwali', year: 2026, month: 11 },
  { id: 'holi', year: 2027, month: 3 }, { id: 'diwali', year: 2027, month: 10 },
  { id: 'holi', year: 2028, month: 3 }, { id: 'diwali', year: 2028, month: 10 },
  { id: 'holi', year: 2029, month: 3 }, { id: 'diwali', year: 2029, month: 11 },
  { id: 'holi', year: 2030, month: 3 }, { id: 'diwali', year: 2030, month: 10 },
  { id: 'holi', year: 2031, month: 3 }, { id: 'diwali', year: 2031, month: 11 },
];

/** The festival look a payday placed in `month` unlocks, if any ("Diwali 2027"). */
export function festivalFor(month: YM): { skin: 'diwali' | 'holi'; label: string } | null {
  const f = FESTIVALS.find((x) => x.year === ymYear(month) && x.month === ymMonth(month) + 1);
  return f ? { skin: f.id, label: `${f.id === 'diwali' ? 'Diwali' : 'Holi'} ${f.year}` } : null;
}

// ---------- levels ----------

export type Level = { n: number; name: string; skin: 'base' | 'steady' | 'secure' | 'builder' | 'halfway' | 'free'; rule: string };

export const LEVELS: Level[] = [
  { n: 1, name: 'Starter', skin: 'base', rule: 'First payday placed' },
  { n: 2, name: 'Steady', skin: 'steady', rule: 'Safety net covers 3 months' },
  { n: 3, name: 'Secure', skin: 'secure', rule: 'Safety net full, no costly debt' },
  { n: 4, name: 'Builder', skin: 'builder', rule: '12 paydays on time, every goal funded' },
  { n: 5, name: 'Halfway', skin: 'halfway', rule: 'Investments cover half your retirement' },
  { n: 6, name: 'Free', skin: 'free', rule: 'Retirement fully covered' },
];

export type LevelCheck = { met: boolean; progress: number; detail: string; blocker: string | null };

const fmtL = (v: number) => {
  const l = v / 1e5;
  return l >= 100 ? `₹${(l / 100).toFixed(l % 100 === 0 ? 0 : 1)} Cr` : `₹${l >= 10 ? Math.round(l) : Math.round(l * 10) / 10} L`;
};
const fmt = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

/** Whether level `n`'s condition holds now, how far along it is (0..1) and the one thing blocking it. */
export function checkLevel(n: number, input: PlanInput, streak: number): LevelCheck {
  const sn = safetyNet(input);
  const costly = (() => {
    const r = input.flowRules.find((x) => x.type === 'costlyDebt');
    const t = r && r.type === 'costlyDebt' ? r.thresholdPct : 12;
    return input.loans.filter((l) => l.balance > 0 && l.ratePct > t);
  })();
  const invested = input.holdings.filter((h) => h.planned).reduce((a, h) => a + h.value, 0);
  const retire = input.goals.find((g) => g.isRetirement);
  const corpus = retire ? retirementCorpus(retire, input, retire.retirement?.retireAge ?? 60) : 0;
  switch (n) {
    case 1:
      return { met: streak > 0, progress: streak > 0 ? 1 : 0, detail: 'First payday placed', blocker: streak > 0 ? null : 'Place your first payday' };
    case 2: {
      const months = sn && input.profile.monthlyExpenses > 0 ? sn.current / input.profile.monthlyExpenses : 0;
      return { met: months >= 3, progress: Math.min(1, months / 3), detail: `${Math.min(3, Math.floor(months))} of 3 months`, blocker: months >= 3 ? null : `Safety net needs ${fmt((3 - months) * input.profile.monthlyExpenses)} more` };
    }
    case 3: {
      const full = !!sn?.full;
      return {
        met: full && costly.length === 0,
        progress: (full ? 0.5 : 0) + (costly.length === 0 ? 0.5 : 0),
        detail: 'Safety net full, no costly debt',
        blocker: !full ? 'Fill the safety net' : costly.length ? `Clear ${costly[0].name}` : null,
      };
    }
    case 4: {
      const results = planGoals(input).map((g) => goalResultFast(input, g));
      const short = results.filter((r) => r.requiredMonthly != null && r.actualMonthly < r.requiredMonthly).sort((a, b) => b.requiredMonthly! - b.actualMonthly - (a.requiredMonthly! - a.actualMonthly));
      const funded = short.length === 0;
      const paydays = Math.min(12, streak);
      const blocker = !funded ? `${short[0].name === "Child's education" ? 'Education' : short[0].name} needs ${fmt(short[0].requiredMonthly! - short[0].actualMonthly)} more` : paydays < 12 ? `${12 - paydays} more paydays` : null;
      return { met: paydays >= 12 && funded, progress: paydays / 12, detail: `${paydays} of 12 paydays`, blocker };
    }
    case 5:
    case 6: {
      const share = n === 5 ? 0.5 : 1;
      const need = corpus * share;
      return { met: need > 0 && invested >= need, progress: need > 0 ? Math.min(1, invested / need) : 0, detail: `${fmtL(invested)} of ${fmtL(need)}`, blocker: invested >= need ? null : `${fmtL(need - invested)} more invested` };
    }
  }
  return { met: false, progress: 0, detail: '', blocker: null };
}

/** The next level reached (in order, once each, never down) given the levels already unlocked. */
export function nextUnlock(unlocked: number, input: PlanInput, streak: number): Level | null {
  const n = unlocked + 1;
  if (n > LEVELS.length) return null;
  return checkLevel(n, input, streak).met ? LEVELS[n - 1] : null;
}

export const monthName = (m: YM) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][ymMonth(m)];
export const shortMonth = (m: YM) => MONTHS[ymMonth(m)];
