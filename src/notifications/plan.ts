/**
 * The notification planner (07-NOTIFICATIONS-WIDGETS.md): which of the 8 kinds go out in the next
 * 8 weeks, when, and with what words. Pure TS so it can be tested; `schedule.ts` hands the result to
 * expo-notifications. Rules: max 2 per rolling 7 days (by priority), quiet hours move a notification
 * to 8 am, each kind can be switched off, and amounts can be hidden on the lock screen.
 */

export type NotifyKind = 'payday' | 'checkIn' | 'goalReached' | 'safetyNet' | 'valueUpdate' | 'goalNear' | 'ppf' | 'yearly';

/** Priority when the 2-a-week cap bites (lower wins). */
export const PRIORITY: Record<NotifyKind, number> = { payday: 0, checkIn: 1, goalReached: 2, safetyNet: 3, valueUpdate: 4, goalNear: 5, ppf: 6, yearly: 7 };

export type NotifyPrefs = {
  payday: boolean;
  checkIn: boolean;
  valueUpdate: boolean;
  /** Goals reached, safety net full, streaks. */
  milestones: boolean;
  /** Glide path moves, goal near. */
  goalChanges: boolean;
  ppf: boolean;
  yearly: boolean;
  hideOnLockScreen: boolean;
  quietHours: boolean;
};

export type NotifyInput = {
  now: Date;
  prefs: NotifyPrefs;
  /** Day of month money lands (1–31), 0 = last day, -1 = varies (no dated payday). */
  paydayDay: number;
  monthly: number;
  /** "4 goals and your PPF" (built by the caller from the plan). */
  splitLine: string;
  /** This month's payday is already placed. */
  placedThisMonth: boolean;
  moves: { ticked: number; total: number } | null;
  lastValueAt: Date | null;
  goals: { id: string; name: string; date: Date }[];
  ppf: { left: number; cap: number } | null;
  riskCheckedAt: Date | null;
  /** In-app moments not yet seen; scheduled only when the app goes to the background. */
  pending?: { kind: 'goalReached' | 'safetyNet'; goalId?: string; name?: string; amount?: number; nextMonth?: string }[];
};

export type PlannedNotification = { id: string; kind: NotifyKind; at: Date; title: string; body: string; url: string; category?: 'payday' };

const DAY = 86400000;
const WINDOW = 7 * DAY;
const HORIZON = 8 * 7 * DAY;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const lakh = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr` : `₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`);

const at9 = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h, 0, 0, 0);
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Quiet hours (10 pm – 8 am) push a time to 8 am. */
export function applyQuiet(d: Date, on: boolean): Date {
  if (!on) return d;
  const h = d.getHours();
  if (h >= 22) return at9(d.getFullYear(), d.getMonth(), d.getDate() + 1, 8);
  if (h < 8) return at9(d.getFullYear(), d.getMonth(), d.getDate(), 8);
  return d;
}

/** Payday dates (9 am) from now for the next 8 weeks. */
function paydays(now: Date, day: number): Date[] {
  if (day < 0) return [];
  const out: Date[] = [];
  for (let k = 0; k < 3; k++) {
    const y = now.getFullYear();
    const m = now.getMonth() + k;
    const dd = day === 0 ? lastDay(y, m) : Math.min(day, lastDay(y, m));
    out.push(at9(y, m, dd));
  }
  return out;
}

export function candidates(i: NotifyInput): PlannedNotification[] {
  const p = i.prefs;
  const hide = p.hideOnLockScreen;
  const out: PlannedNotification[] = [];
  const now = i.now.getTime();
  if (p.payday && i.monthly > 0) {
    for (const d of paydays(i.now, i.paydayDay)) {
      const thisMonth = d.getMonth() === i.now.getMonth() && d.getFullYear() === i.now.getFullYear();
      if (thisMonth && i.placedThisMonth) continue;
      out.push({ id: `payday-${d.getFullYear()}-${d.getMonth()}`, kind: 'payday', at: d, title: hide ? 'Payday: money to place' : `Payday: ${inr(i.monthly)} to place`, body: `${i.splitLine}. Tap to see the split.`, url: '/payday', category: 'payday' });
      if (p.checkIn) {
        const next = new Date(d.getTime() + DAY);
        const left = thisMonth && i.moves ? i.moves.total - i.moves.ticked : null;
        if (left === 0) continue;
        out.push({
          id: `checkin-${d.getFullYear()}-${d.getMonth()}`,
          kind: 'checkIn',
          at: next,
          title: `Did ${MONTHS[d.getMonth()]}'s money go in?`,
          body: thisMonth && i.moves ? `${i.moves.ticked} of ${i.moves.total} moves ticked. Two taps to finish.` : 'Tick off the moves. Two taps to finish.',
          url: '/payday/check-in',
        });
      }
    }
  }
  if (p.valueUpdate && i.lastValueAt) {
    const due = new Date(Math.max(i.lastValueAt.getTime() + 30 * DAY, now + DAY));
    out.push({ id: 'values', kind: 'valueUpdate', at: at9(due.getFullYear(), due.getMonth(), due.getDate(), 10), title: 'Your values are 30 days old', body: 'Confirm them in 20 seconds to keep goals accurate.', url: '/payday/values?standalone=1' });
  }
  if (p.goalChanges) {
    for (const g of i.goals) {
      for (const years of [5, 3, 1]) {
        const d = new Date(g.date.getFullYear() - years, g.date.getMonth(), 1, 10);
        if (d.getTime() <= now || d.getTime() > now + HORIZON) continue;
        out.push({
          id: `near-${g.id}-${years}`,
          kind: 'goalNear',
          at: d,
          title: `${g.name} is ${years === 1 ? 'a year' : `${years} years`} away`,
          body: years === 1 ? 'Its money now sits mostly in debt and cash.' : 'From now, new money for it goes to steadier places first.',
          url: `/goal/${g.id}`,
        });
      }
    }
  }
  if (p.ppf && i.ppf && i.ppf.left > 0) {
    const y = i.now.getMonth() > 2 || (i.now.getMonth() === 2 && i.now.getDate() > 15) ? i.now.getFullYear() + 1 : i.now.getFullYear();
    const d = at9(y, 2, 15, 10);
    out.push({ id: `ppf-${y}`, kind: 'ppf', at: d, title: hide ? 'Room left for PPF this year' : `${inr(i.ppf.left)} left for PPF this year`, body: hide ? 'Add it by 31 March to use the full yearly limit.' : `Add it by 31 March to use the full ${lakh(i.ppf.cap)}.`, url: '/payday/rules' });
  }
  if (p.yearly && i.riskCheckedAt) {
    const due = new Date(i.riskCheckedAt.getFullYear() + 1, i.riskCheckedAt.getMonth(), Math.max(2, i.riskCheckedAt.getDate()), 11);
    const at = due.getTime() <= now ? new Date(now + DAY) : due;
    out.push({ id: 'yearly', kind: 'yearly', at: new Date(at.getFullYear(), at.getMonth(), at.getDate(), 11), title: "It's been a year", body: '2 minutes to check your risk profile still fits.', url: '/onboarding/risk?retake=1' });
  }
  if (p.milestones) {
    for (const m of i.pending ?? []) {
      const soon = new Date(now + 60_000);
      if (m.kind === 'goalReached')
        out.push({ id: `reached-${m.goalId}`, kind: 'goalReached', at: soon, title: `${m.name} is paid for!`, body: hide || m.amount == null ? 'Tap to decide what happens next.' : `${lakh(m.amount)} ready. Tap to decide what happens next.`, url: `/goal/day/${m.goalId}` });
      else out.push({ id: 'safety-full', kind: 'safetyNet', at: soon, title: 'Your safety net is full', body: `From ${m.nextMonth ?? 'next month'}, money flows on to your goals.`, url: '/milestone?kind=safety' });
    }
  }
  return out.filter((n) => n.at.getTime() > now && n.at.getTime() <= now + HORIZON);
}

/** At most 2 in any 7 days: higher priority first, then earlier. */
export function capTwoAWeek(list: PlannedNotification[]): PlannedNotification[] {
  const accepted: PlannedNotification[] = [];
  const ordered = [...list].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.at.getTime() - b.at.getTime());
  for (const n of ordered) {
    const times = [...accepted.map((x) => x.at.getTime()), n.at.getTime()].sort((a, b) => a - b);
    let ok = true;
    for (let k = 0; k + 2 < times.length; k++) if (times[k + 2] - times[k] < WINDOW) ok = false;
    if (ok) accepted.push(n);
  }
  return accepted.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function planNotifications(i: NotifyInput): PlannedNotification[] {
  const list = candidates(i).map((n) => ({ ...n, at: applyQuiet(n.at, i.prefs.quietHours) }));
  return capTwoAWeek(list);
}

export const DEFAULT_PREFS: NotifyPrefs = { payday: true, checkIn: true, valueUpdate: true, milestones: true, goalChanges: true, ppf: true, yearly: true, hideOnLockScreen: false, quietHours: true };
