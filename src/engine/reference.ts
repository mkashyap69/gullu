/**
 * Line-for-line TypeScript port of reference/engine.js (the original single-goal engine).
 * It is the regression baseline: Fixture A must produce identical numbers.
 * Do not "improve" this file. The v1 multi-goal engine lives in core.ts / plan.ts.
 */
export type RefBucketKind = 'emergency' | 'gold' | 'ppf' | 'passive' | 'invest';
export type RefBucket = { id: string; kind: RefBucketKind; bal: number; ret: number; share?: number };
export type RefEvent =
  | { type: 'pause'; m: number; months: number }
  | { type: 'in'; m: number; amount: number }
  | { type: 'expense'; m: number; amount: number };

export type RefParams = {
  sip: number;
  stepUp: number;
  goal: number;
  years: number;
  startMonth: number; // 0 = Jan
  expenses: number;
  monthsCover: number;
  method: 'liquid' | 'rd12' | 'rd24';
  rdRate: number;
  goldPct: number;
  ppfLimit: number;
  ppfPaid?: number;
  marketShift?: number;
  events?: RefEvent[];
  buckets: RefBucket[];
};

export type RefRow = {
  m: number;
  cm: number;
  alloc: Record<string, number>;
  taken: Record<string, number>;
  tags: string[];
  mlf?: number;
  ppfPaid?: number;
  sip?: number;
  extra?: number;
  expense?: number;
  cash?: number;
  growth?: number;
  bal?: Record<string, number>;
  rdBal?: number;
  inv: number;
};

export type RefTags = { ef?: number; gold?: number; goal?: number; firstInv?: number };
export type RefResult = { rows: RefRow[]; tags: RefTags; horizon: number; target: number; rdInst: number | null };

const rm = (a: number) => Math.pow(1 + a / 100, 1 / 12) - 1;

export function simulateReference(p: RefParams, opt: { sipOverride?: number; extraMonths?: number } = {}): RefResult {
  const sipBase = opt.sipOverride != null ? opt.sipOverride : p.sip;
  const H = p.years * 12 + (opt.extraMonths || 0);
  const B = p.buckets.map((b) => ({ ...b }));
  const idx: Record<string, number> = {};
  B.forEach((b, i) => {
    idx[b.id] = i;
  });
  const shift = p.marketShift || 0;
  const target = p.expenses * p.monthsCover;
  let rd: { ten: number; rr: number; inst: number; bal: number } | null = null;
  if (p.method === 'rd12' || p.method === 'rd24') {
    const ten = p.method === 'rd12' ? 12 : 24;
    const rr = rm(p.rdRate);
    let s = 0;
    for (let k = 1; k <= ten; k++) s += Math.pow(1 + rr, k);
    rd = { ten, rr, inst: Math.max(0, target - B[idx.emergency].bal) / s, bal: 0 };
  }
  let ppfPaid = p.ppfPaid || 0;
  const rows: RefRow[] = [];
  const tags: RefTags = {};
  const invTotal = () => B.reduce((a, b) => (b.kind === 'emergency' ? a : a + b.bal), 0);
  for (let m = 0; m < H; m++) {
    const cm = (p.startMonth + m) % 12;
    const row: RefRow = { m, cm, alloc: {}, taken: {}, tags: [], inv: 0 };
    if (cm === 3) ppfPaid = 0;
    if (rd && m === rd.ten) {
      B[idx.emergency].bal += rd.bal;
      rd.bal = 0;
      row.tags.push('RD matures');
    }
    let sip = sipBase * Math.pow(1 + p.stepUp / 100, Math.floor(m / 12));
    let extra = 0;
    let expense = 0;
    (p.events || []).forEach((e) => {
      if (e.type === 'pause' && m >= e.m && m < e.m + e.months) sip = 0;
      if (e.type === 'in' && e.m === m) extra += e.amount;
      if (e.type === 'expense' && e.m === m) expense += e.amount;
    });
    if (expense) {
      let need = expense;
      ['emergency', 'core', 'us', 'high', 'gold'].forEach((id) => {
        const b = B[idx[id]];
        const t = Math.min(need, b.bal);
        b.bal -= t;
        need -= t;
        if (t) row.taken[id] = t;
      });
    }
    const cash = sip + extra;
    let left = cash;
    // step 1
    const em = B[idx.emergency];
    let e1 = 0;
    if (rd && m < rd.ten) {
      e1 = Math.min(left, rd.inst);
      rd.bal += e1;
    } else {
      e1 = Math.min(left, Math.max(0, target - em.bal));
      em.bal += e1;
    }
    left -= e1;
    row.alloc.emergency = e1;
    // step 2
    const g = B[idx.gold];
    const gap = (p.goldPct / 100) * (invTotal() + left) - g.bal;
    const a2 = Math.min(left, Math.max(0, gap));
    g.bal += a2;
    left -= a2;
    row.alloc.gold = a2;
    // step 3
    const mlf = cm <= 2 ? 3 - cm : 15 - cm;
    const pp = B[idx.ppf];
    const a3 = Math.min(left, Math.max(0, p.ppfLimit - ppfPaid) / mlf);
    pp.bal += a3;
    ppfPaid += a3;
    left -= a3;
    row.alloc.ppf = a3;
    row.mlf = mlf;
    row.ppfPaid = ppfPaid;
    // step 4
    const inv = B.filter((b) => b.kind === 'invest');
    const shTot = inv.reduce((a, b) => a + (b.share ?? 0), 0);
    const eq = inv.reduce((a, b) => a + b.bal, 0) + left;
    const gaps = inv.map((b) => Math.max(0, ((b.share ?? 0) / shTot) * eq - b.bal));
    const G = gaps.reduce((a, x) => a + x, 0);
    const leftNow = left;
    inv.forEach((b, i) => {
      const a =
        G >= leftNow
          ? G > 0
            ? (leftNow * gaps[i]) / G
            : 0
          : gaps[i] + ((leftNow - G) * (b.share ?? 0)) / shTot;
      b.bal += a;
      row.alloc[b.id] = a;
    });
    // growth
    const before = B.reduce((a, b) => a + b.bal, 0) + (rd ? rd.bal : 0);
    B.forEach((b) => {
      const r = b.ret + (b.kind === 'gold' || b.kind === 'invest' ? shift : 0);
      b.bal *= 1 + rm(r);
    });
    if (rd) rd.bal *= 1 + rd.rr;
    const after = B.reduce((a, b) => a + b.bal, 0) + (rd ? rd.bal : 0);
    row.sip = sip;
    row.extra = extra;
    row.expense = expense;
    row.cash = cash;
    row.growth = after - before;
    row.bal = {};
    B.forEach((b) => {
      row.bal![b.id] = b.bal;
    });
    row.rdBal = rd ? rd.bal : 0;
    row.inv = invTotal();
    const emTot = em.bal + (rd ? rd.bal : 0);
    if (tags.ef == null && emTot >= target) {
      tags.ef = m;
      row.tags.push('Emergency fund full');
    }
    if (tags.gold == null && g.bal >= ((0.99 * p.goldPct) / 100) * row.inv) {
      tags.gold = m;
      row.tags.push('Gold at target');
    }
    if (tags.goal == null && row.inv >= p.goal) {
      tags.goal = m;
      row.tags.push('Goal reached');
    }
    if (tags.firstInv == null && inv.some((b) => row.alloc[b.id] > 0.5)) tags.firstInv = m;
    if (cm === 2) row.tags.push('PPF year ends');
    rows.push(row);
  }
  return { rows, tags, horizon: p.years * 12, target, rdInst: rd ? rd.inst : null };
}

export function requiredSipReference(p: RefParams): number | null {
  const H = p.years * 12;
  const ok = (s: number) => simulateReference(p, { sipOverride: s }).rows[H - 1].inv >= p.goal;
  if (ok(0)) return 0;
  if (!ok(5000000)) return null;
  let lo = 0;
  let hi = 5000000;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 500) * 500;
}
