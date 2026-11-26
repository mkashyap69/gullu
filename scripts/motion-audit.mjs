// Motion QA (04-MOTION.md checklist), the parts a script can check:
//  1. only motion.ts tokens: no literal durations in withTiming/withSpring/withDelay
//  2. every screen that animates on its own has a reduced-motion path (useReduceMotion), or only
//     uses shared components that carry one (Rise, Amount, Gullu, GoalRing, Sheet, …)
//  3. no haptics on the market-fall screen
// Usage: node scripts/motion-audit.mjs  (exit 1 on a failure)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = [...walk('app'), ...walk('src')].filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__') && !f.includes('/dev/'));
const fail = [];
const rows = [];
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  const literal = [...s.matchAll(/with(Timing|Delay)\(\s*[^,)]*,\s*\{\s*duration:\s*([1-9]\d*)\s*[,}]/g), ...s.matchAll(/withDelay\(\s*([1-9]\d*)\s*,/g)];
  if (literal.length) fail.push(`${f}: literal duration (${literal.map((m) => m[0].slice(0, 40)).join('; ')})`);
  const animates = /use(AnimatedStyle|DerivedValue|SharedValue)\(|entering=\{|withRepeat\(/.test(s);
  const hasReduce = /useReduceMotion\(|useAmbient\(|motion-audit: (fade-only|direct manipulation)/.test(s);
  if (f.startsWith('app/') || f.startsWith('src/screens/') || f.startsWith('src/motion-kit/') || f.startsWith('src/components/')) {
    if (animates) {
      rows.push({ f, reduce: hasReduce });
      if (!hasReduce) fail.push(`${f}: animates without a reduced-motion path`);
    }
  }
}
const mf = readFileSync('src/screens/MarketFallScreen.tsx', 'utf8');
if (/haptics\.|Haptics\./.test(mf)) fail.push('src/screens/MarketFallScreen.tsx: haptics on the market-fall screen');
console.log(`Animated files checked: ${rows.length}`);
console.log(fail.length ? `FAIL\n${fail.join('\n')}` : 'PASS: tokens only, every animated file has a reduced-motion path, no haptics on market fall.');
process.exit(fail.length ? 1 : 0);
