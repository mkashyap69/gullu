// Minimal JS port of plan_engine (liquid / new RD emergency methods; events: expense, moneyIn, pauseSip)
function simulate(p, opt) {
  opt = opt || {};
  var sipBase = opt.sipOverride != null ? opt.sipOverride : p.sip;
  var H = p.years * 12 + (opt.extraMonths || 0);
  var B = p.buckets.map(function (b) { return Object.assign({}, b); });
  var idx = {}; B.forEach(function (b, i) { idx[b.id] = i; });
  var rm = function (a) { return Math.pow(1 + a / 100, 1 / 12) - 1; };
  var shift = p.marketShift || 0;
  var target = p.expenses * p.monthsCover;
  var rd = null;
  if (p.method === 'rd12' || p.method === 'rd24') {
    var ten = p.method === 'rd12' ? 12 : 24, rr = rm(p.rdRate), s = 0;
    for (var k = 1; k <= ten; k++) s += Math.pow(1 + rr, k);
    rd = { ten: ten, rr: rr, inst: Math.max(0, target - B[idx.emergency].bal) / s, bal: 0 };
  }
  var ppfPaid = p.ppfPaid || 0, rows = [], tags = {};
  var invTotal = function () { return B.reduce(function (a, b) { return b.kind === 'emergency' ? a : a + b.bal; }, 0); };
  for (var m = 0; m < H; m++) {
    var cm = (p.startMonth + m) % 12; // 0=Jan
    var row = { m: m, cm: cm, alloc: {}, taken: {}, tags: [] };
    if (cm === 3) ppfPaid = 0;
    if (rd && m === rd.ten) { B[idx.emergency].bal += rd.bal; rd.bal = 0; row.tags.push('RD matures'); }
    var sip = sipBase * Math.pow(1 + p.stepUp / 100, Math.floor(m / 12));
    var extra = 0, expense = 0;
    (p.events || []).forEach(function (e) {
      if (e.type === 'pause' && m >= e.m && m < e.m + e.months) sip = 0;
      if (e.type === 'in' && e.m === m) extra += e.amount;
      if (e.type === 'expense' && e.m === m) expense += e.amount;
    });
    if (expense) {
      var need = expense;
      ['emergency', 'core', 'us', 'high', 'gold'].forEach(function (id) {
        var b = B[idx[id]]; var t = Math.min(need, b.bal); b.bal -= t; need -= t; if (t) row.taken[id] = t;
      });
    }
    var cash = sip + extra, left = cash;
    // step 1
    var em = B[idx.emergency], e1 = 0;
    if (rd && m < rd.ten) { e1 = Math.min(left, rd.inst); rd.bal += e1; }
    else e1 = Math.min(left, Math.max(0, target - em.bal) ), em.bal += e1;
    left -= e1; row.alloc.emergency = e1;
    // step 2
    var g = B[idx.gold], gap = p.goldPct / 100 * (invTotal() + left) - g.bal;
    var a2 = Math.min(left, Math.max(0, gap)); g.bal += a2; left -= a2; row.alloc.gold = a2;
    // step 3
    var mlf = cm <= 2 ? 3 - cm : 15 - cm;
    var pp = B[idx.ppf], a3 = Math.min(left, Math.max(0, p.ppfLimit - ppfPaid) / mlf);
    pp.bal += a3; ppfPaid += a3; left -= a3; row.alloc.ppf = a3; row.mlf = mlf; row.ppfPaid = ppfPaid;
    // step 4
    var inv = B.filter(function (b) { return b.kind === 'invest'; });
    var shTot = inv.reduce(function (a, b) { return a + b.share; }, 0);
    var eq = inv.reduce(function (a, b) { return a + b.bal; }, 0) + left;
    var gaps = inv.map(function (b) { return Math.max(0, b.share / shTot * eq - b.bal); });
    var G = gaps.reduce(function (a, x) { return a + x; }, 0);
    inv.forEach(function (b, i) {
      var a = G >= left ? (G > 0 ? left * gaps[i] / G : 0) : gaps[i] + (left - G) * b.share / shTot;
      b.bal += a; row.alloc[b.id] = a;
    });
    // growth
    var before = B.reduce(function (a, b) { return a + b.bal; }, 0) + (rd ? rd.bal : 0);
    B.forEach(function (b) {
      var r = b.ret + ((b.kind === 'gold' || b.kind === 'invest') ? shift : 0);
      b.bal *= 1 + rm(r);
    });
    if (rd) rd.bal *= 1 + rd.rr;
    var after = B.reduce(function (a, b) { return a + b.bal; }, 0) + (rd ? rd.bal : 0);
    row.sip = sip; row.extra = extra; row.expense = expense; row.cash = cash; row.growth = after - before;
    row.bal = {}; B.forEach(function (b) { row.bal[b.id] = b.bal; });
    row.rdBal = rd ? rd.bal : 0;
    row.inv = invTotal();
    var emTot = em.bal + (rd ? rd.bal : 0);
    if (tags.ef == null && emTot >= target) { tags.ef = m; row.tags.push('Emergency fund full'); }
    if (tags.gold == null && g.bal >= 0.99 * p.goldPct / 100 * row.inv) { tags.gold = m; row.tags.push('Gold at target'); }
    if (tags.goal == null && row.inv >= p.goal) { tags.goal = m; row.tags.push('Goal reached'); }
    if (tags.firstInv == null && inv.some(function (b) { return row.alloc[b.id] > 0.5; })) tags.firstInv = m;
    if (cm === 2) row.tags.push('PPF year ends');
    rows.push(row);
  }
  return { rows: rows, tags: tags, horizon: p.years * 12, target: target, rdInst: rd ? rd.inst : null };
}
function requiredSip(p) {
  var H = p.years * 12;
  var ok = function (s) { return simulate(p, { sipOverride: s }).rows[H - 1].inv >= p.goal; };
  if (ok(0)) return 0; if (!ok(5000000)) return null;
  var lo = 0, hi = 5000000;
  for (var i = 0; i < 36; i++) { var mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return Math.ceil(hi / 500) * 500;
}
if (typeof module !== 'undefined') module.exports = { simulate: simulate, requiredSip: requiredSip };
