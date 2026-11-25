/**
 * Challenges (06-HABITS.md, 10.4–10.5): self-chosen promises. Gullu only keeps count; progress is
 * read from real data (paydays, value updates, money minute answers, loans, PPF), never typed in.
 * At most 2 active. Finishing one gives a quiet check. No prizes. Pure TS.
 */
import { paidThisFy } from './plan';
import type { PlanInput, YM } from './types';

export type ChallengeId = 'raiseSip' | 'updateValues3' | 'learn4' | 'noNewLoan' | 'bonusToWork' | 'noSkipQuarter' | 'maxPpf';

export type ChallengeData = {
  id: ChallengeId | string;
  name: string;
  target: number;
  /** Last progress seen (kept for the record; the live value is computed). */
  progress: number;
  done: boolean;
  /** Ended without finishing (shown neutrally) or removed by the user. */
  ended?: boolean;
  /** What the challenge started from. */
  start?: { month: YM; monthly?: number; loanIds?: string[]; appraisalMonth?: YM };
};

export const CHALLENGES: { id: ChallengeId; name: string; detail: string; target: number; pickable: boolean }[] = [
  { id: 'raiseSip', name: 'Raise my SIP 10% at my appraisal', detail: 'You pick the month', target: 1, pickable: true },
  { id: 'updateValues3', name: 'Update values every month for 3 months', detail: 'Keeps your plan accurate', target: 3, pickable: true },
  { id: 'learn4', name: 'Learn 4 money cards this month', detail: 'About 1 minute each', target: 4, pickable: true },
  { id: 'noNewLoan', name: 'No new loan this year', detail: 'Protects every goal', target: 12, pickable: true },
  { id: 'bonusToWork', name: 'Put my bonus to work', detail: 'Split it across goals', target: 1, pickable: true },
  { id: 'noSkipQuarter', name: 'No skipped payday this quarter', detail: 'Three paydays in a row', target: 3, pickable: false },
  { id: 'maxPpf', name: 'Max PPF before 31 March', detail: 'The full ₹1.5 L this year', target: 150000, pickable: false },
];
export const MAX_ACTIVE = 2;

export type ChallengeContext = {
  input: PlanInput;
  /** Months with a placed payday, and the kind of each. */
  paydays: { month: YM; kind: 'same' | 'less' | 'bonus'; placed: boolean }[];
  /** Months with a confirmed total value. */
  valueMonths: YM[];
  /** Money minute answers: the month each was given. */
  minuteMonths: YM[];
};

export type ChallengeStatus = { progress: number; target: number; done: boolean; ended: boolean; label: string };

const L = (v: number) => (v >= 1e5 ? `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')} L` : `₹${v.toLocaleString('en-IN')}`);

export function challengeStatus(c: ChallengeData, ctx: ChallengeContext): ChallengeStatus {
  const start = c.start?.month ?? ctx.input.today;
  const today = ctx.input.today;
  const placed = new Set(ctx.paydays.filter((p) => p.placed).map((p) => p.month));
  let progress = 0;
  let target = c.target;
  let ended = !!c.ended;
  let label = '';
  switch (c.id) {
    case 'noSkipQuarter': {
      // The three months starting with the month it was picked.
      for (let m = start; m < start + 3; m++) if (placed.has(m)) progress++;
      target = 3;
      label = `${progress} of 3 months`;
      break;
    }
    case 'maxPpf': {
      const r = ctx.input.flowRules.find((x) => x.type === 'commitment' && x.instrument === 'PPF');
      target = r && r.type === 'commitment' ? r.yearlyCap : 150000;
      progress = r && r.type === 'commitment' ? paidThisFy(r, today) : 0;
      label = `${L(progress)} of ${L(target)}`;
      break;
    }
    case 'updateValues3': {
      // Value updates in 3 months in a row, counted from the start.
      const months = new Set(ctx.valueMonths);
      let run = 0;
      for (let m = start; m <= today; m++) {
        run = months.has(m) ? run + 1 : m < today ? 0 : run;
        progress = Math.max(progress, run);
      }
      progress = Math.min(3, progress);
      label = `${progress} of 3 months`;
      break;
    }
    case 'learn4': {
      progress = Math.min(4, ctx.minuteMonths.filter((m) => m === start).length);
      if (today > start && progress < 4) ended = true;
      label = `${progress} of 4 cards`;
      break;
    }
    case 'noNewLoan': {
      const before = new Set(c.start?.loanIds ?? []);
      const added = ctx.input.loans.some((l) => !before.has(l.id));
      if (added) ended = true;
      progress = Math.min(12, today - start);
      label = added ? 'A loan was added' : `${progress} of 12 months`;
      break;
    }
    case 'bonusToWork': {
      progress = ctx.paydays.some((p) => p.placed && p.kind === 'bonus' && p.month >= start) ? 1 : 0;
      label = progress ? 'Bonus placed' : 'Waiting for your bonus';
      break;
    }
    case 'raiseSip': {
      const from = c.start?.monthly ?? ctx.input.profile.monthly;
      const due = c.start?.appraisalMonth ?? start;
      progress = ctx.input.profile.monthly >= Math.ceil(from * 1.1) ? 1 : 0;
      label = progress ? 'Raised' : today < due ? `In ${monthsWord(due - today)}` : `From ${L(from)} to ${L(Math.ceil((from * 1.1) / 500) * 500)} a month`;
      break;
    }
  }
  const done = c.done || progress >= target;
  return { progress, target, done, ended: ended && !done, label };
}

const monthsWord = (n: number) => (n === 1 ? '1 month' : `${n} months`);

/** The latest state of each challenge (events are append-only). */
export function latestChallenges<T extends { kind: string; data: unknown; at: number }>(events: T[]): ChallengeData[] {
  const byId = new Map<string, ChallengeData>();
  for (const e of events) if (e.kind === 'challenge') byId.set((e.data as ChallengeData).id, e.data as ChallengeData);
  return [...byId.values()];
}

export const isActive = (c: ChallengeData) => !c.done && !c.ended;
