/**
 * @jest-environment node
 */
import { DEFAULT_PREFS, applyQuiet, capTwoAWeek, planNotifications, type NotifyInput, type PlannedNotification } from '../plan';

const base = (over: Partial<NotifyInput> = {}): NotifyInput => ({
  now: new Date(2028, 2, 28, 12), // 28 March 2028
  prefs: { ...DEFAULT_PREFS },
  paydayDay: 1,
  monthly: 55000,
  splitLine: '4 goals and your PPF',
  placedThisMonth: true,
  moves: null,
  lastValueAt: new Date(2028, 2, 1),
  goals: [{ id: 'trip', name: 'Japan trip', date: new Date(2029, 3, 1) }],
  ppf: { left: 37500, cap: 150000 },
  riskCheckedAt: new Date(2027, 3, 2),
  ...over,
});

test('payday on the 1st at 9 am, with the design copy', () => {
  const p = planNotifications(base()).find((n) => n.kind === 'payday')!;
  expect(p.at).toEqual(new Date(2028, 3, 1, 9));
  expect(p.title).toBe('Payday: ₹55,000 to place');
  expect(p.body).toBe('4 goals and your PPF. Tap to see the split.');
  expect(p.url).toBe('/payday');
});

test('never more than 2 in any 7 days; payday outranks the rest', () => {
  const list = planNotifications(base());
  const times = list.map((n) => n.at.getTime()).sort((a, b) => a - b);
  for (let k = 0; k + 2 < times.length; k++) expect(times[k + 2] - times[k]).toBeGreaterThanOrEqual(7 * 86400000);
  const crowd: PlannedNotification[] = ['yearly', 'ppf', 'payday'].map((kind, i) => ({ id: kind, kind: kind as PlannedNotification['kind'], at: new Date(2028, 3, 1 + i, 9), title: '', body: '', url: '' }));
  expect(capTwoAWeek(crowd).map((n) => n.kind)).toEqual(['ppf', 'payday']);
});

test('hide amounts on the lock screen: "Payday: money to place", no rupees anywhere', () => {
  const list = planNotifications(base({ prefs: { ...DEFAULT_PREFS, hideOnLockScreen: true }, pending: [{ kind: 'goalReached', goalId: 'trip', name: 'Japan', amount: 331000 }] }));
  expect(list.find((n) => n.kind === 'payday')!.title).toBe('Payday: money to place');
  for (const n of list) expect(`${n.title} ${n.body}`).not.toMatch(/₹/);
});

test('quiet hours move a notification to 8 am; switched-off kinds never go out', () => {
  expect(applyQuiet(new Date(2028, 3, 1, 23), true)).toEqual(new Date(2028, 3, 2, 8));
  expect(applyQuiet(new Date(2028, 3, 1, 6), true)).toEqual(new Date(2028, 3, 1, 8));
  const off = planNotifications(base({ prefs: { ...DEFAULT_PREFS, payday: false } }));
  expect(off.some((n) => n.kind === 'payday' || n.kind === 'checkIn')).toBe(false);
});

test('check-in only when moves are left; goal reached copy from the design', () => {
  const none = planNotifications(base({ now: new Date(2028, 3, 1, 12), placedThisMonth: false, moves: { ticked: 7, total: 7 } }));
  expect(none.some((n) => n.id === 'checkin-2028-3')).toBe(false);
  const some = planNotifications(base({ now: new Date(2028, 3, 1, 8), placedThisMonth: false, moves: { ticked: 4, total: 7 } }));
  expect(some.find((n) => n.id === 'checkin-2028-3')!.body).toBe('4 of 7 moves ticked. Two taps to finish.');
  const r = planNotifications(base({ now: new Date(2028, 2, 10, 12), pending: [{ kind: 'goalReached', goalId: 'trip', name: 'Japan', amount: 331000 }] })).find((n) => n.kind === 'goalReached')!;
  expect(`${r.title} / ${r.body}`).toBe('Japan is paid for! / ₹3.31 L ready. Tap to decide what happens next.');
});
