// Screenshot comparison (08-BUILD-PLAN Phase 11): captures each screen in the web preview with the
// Manish demo (Sunita for 7.x) at 390×844 and puts it next to design/screens/<id>.png in an HTML
// report. The web preview is an approximation (no native shadows, blur or shared transitions);
// use it to check layout, copy and colours.
//
//   npm run web:setup                          # once: copies CanvasKit for the preview
//   EXPO_OFFLINE=1 npx expo start --web --port 8081
//   node scripts/screenshot-compare.mjs [outDir]   # default: screenshots/
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const out = process.argv[2] ?? 'screenshots';

/** id → route (+ optional steps). `who` defaults to manish. */
const SCREENS = [
  ['V-1-1-Welcome', '/onboarding/welcome', { who: 'none', wait: 3000 }],
  ['V-1-2-AboutYou', '/onboarding/about', { who: 'none' }],
  ['V-1-3-RiskCheck', '/onboarding/risk', { who: 'none' }],
  ['V-1-4-Goals', '/onboarding/goals', { who: 'none' }],
  ['V-1-5-WhatYouHave', '/onboarding/have', { who: 'none' }],
  ['V-1-6-Monthly', '/onboarding/monthly', { who: 'none' }],
  ['V-1-7-Answer', '/dev/moments/answer', { wait: 4000 }],
  ['V-2-1-Home', '/home', { wait: 1300 }],
  ['V-2-2-MarketFall', '/market-fall', { wait: 3000 }],
  ['V-2-3-Milestone', '/milestone?kind=paydays-12', { wait: 3000 }],
  ['V-3-1-Goals', '/goals'],
  ['V-3-2-GoalDetail', '/goal/edu', { wait: 3500 }],
  ['V-3-3-EditGoal', '/goal/edit?id=trip'],
  ['V-3-4-GlidePath', '/goal/glide/home'],
  ['V-3-5-GoalDay', '/goal/day/trip', { wait: 3000 }],
  ['V-4-1-Nudge', '/home', { wait: 1300 }],
  ['V-4-2-Payday', '/payday', { wait: 3500 }],
  ['V-4-3-WhyThisAmount', '/payday/why/home', { wait: 2500 }],
  ['V-4-4-CheckIn', '/payday', { steps: [{ click: 'payday-moves' }], wait: 2000 }],
  ['V-4-5-Receipt', '/dev/moments/receipt', { wait: 4000 }],
  ['V-4-6-ShortMonth', '/payday/amount'],
  ['V-4-7-FlowRules', '/payday/rules'],
  ['V-5-1-NetWorth', '/wealth', { wait: 3000 }],
  ['V-5-2-MixCheck', '/wealth/mix'],
  ['V-5-3-Holdings', '/wealth/holdings'],
  ['V-5-4-Loans', '/wealth/loans'],
  ['V-5-5-Timeline', '/wealth/timeline'],
  ['V-5-6-HoldingSplit', '/wealth/holding/nifty'],
  ['V-6-1-WhatIf', '/what-if'],
  ['V-6-2-Apply', '/what-if', { steps: [{ text: 'Fix off-track goals' }, { click: 'whatif-apply' }], wait: 1500 }],
  ['V-6-3-Scenarios', '/what-if/scenarios'],
  ['V-7-1-IncomePlan', '/home', { who: 'sunita', wait: 3500 }],
  ['V-7-2-ThreeBuckets', '/wealth', { who: 'sunita', wait: 3500 }],
  ['V-7-3-ThisMonthIncome', '/payday', { who: 'sunita', wait: 3000 }],
  ['V-8-1-ProfileRisk', '/you'],
  ['V-8-2-Assumptions', '/you/assumptions'],
  ['V-8-3-Privacy', '/you/privacy'],
  ['V-8-4-Learn', '/you/learn'],
  ['V-8-5-RiskOverride', '/you', { steps: [{ text: 'Change risk profile' }, { click: 'risk-pick-growth' }], wait: 1500 }],
  ['V-9-3-NotificationSettings', '/you/notifications'],
  ['V-10-1-Levels', '/levels', { wait: 3000 }],
  ['V-10-2-LevelUp', '/level-up?n=3', { wait: 4000 }],
  ['V-10-3-Collection', '/collection'],
  ['V-10-4-Streak', '/streak'],
  ['V-10-5-PickChallenge', '/streak/pick'],
  ['V-10-6-MoneyMinute', '/money-minute'],
];

mkdirSync(join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'design'), { recursive: true });
const b = await chromium.launch();
const rows = [];
for (const [id, route, o = {}] of SCREENS) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const who = o.who ?? 'manish';
  const url = BASE + route + (who === 'none' ? '' : `${route.includes('?') ? '&' : '?'}demo=${who}`);
  try {
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    for (const s of o.steps ?? []) {
      if (s.click) await p.locator(`[data-testid="${s.click}"]`).first().click({ force: true });
      if (s.text) await p.getByText(s.text, { exact: true }).first().click({ force: true });
      await p.waitForTimeout(900);
    }
    await p.waitForTimeout(o.wait ?? 1800);
    await p.screenshot({ path: join(out, 'app', `${id}.png`) });
  } catch (e) {
    errors.push(String(e).slice(0, 200));
  }
  if (existsSync(`design/screens/${id}.png`)) copyFileSync(`design/screens/${id}.png`, join(out, 'design', `${id}.png`));
  rows.push({ id, route, errors });
  await p.close();
  console.log(`${errors.length ? '✗' : '✓'} ${id}`);
}
await b.close();
const html = `<!doctype html><meta charset="utf-8"><title>Money Plan · screens vs designs</title>
<style>body{font:14px system-ui;background:#111;color:#eee;margin:24px}h2{font-size:15px;margin:28px 0 8px}.r{display:flex;gap:16px}img{width:300px;border-radius:12px;border:1px solid #333}.e{color:#f88}</style>
<h1>Screens vs designs</h1><p>Left: the design PNG. Right: the web preview with demo data. Generated ${new Date().toISOString().slice(0, 10)}.</p>
${rows.map((r) => `<h2>${r.id} <small>${r.route}</small></h2>${r.errors.length ? `<p class="e">${r.errors.join('<br>')}</p>` : ''}<div class="r"><img src="design/${r.id}.png"><img src="app/${r.id}.png"></div>`).join('\n')}`;
writeFileSync(join(out, 'index.html'), html);
console.log(`Report: ${join(out, 'index.html')}`);
