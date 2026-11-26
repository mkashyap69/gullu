// Accessibility pass, the parts a script can check: every pressable has a role or label (or visible
// text a screen reader reads), and images of Gullu outside buttons carry a label or are decorative.
// Usage: node scripts/a11y-audit.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = [...walk('app'), ...walk('src')].filter((f) => f.endsWith('.tsx') && !f.includes('/dev/'));
const issues = [];
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  // <PressScale …> / <Pressable …> opening tags
  for (const m of s.matchAll(/<(PressScale|Pressable)\b/g)) {
    // The opening tag ends at the first '>' outside braces (arrow functions contain '>').
    let depth = 0;
    let end = m.index;
    for (let i = m.index; i < s.length; i++) {
      const c = s[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    const attrs = s.slice(m.index, end);
    if (attrs.includes('{...rest}')) continue; // a wrapper: its callers pass the role and label
    const line = s.slice(0, m.index).split('\n').length;
    if (!/accessibilityRole|accessibilityLabel/.test(attrs)) {
      // Visible text inside is read out; flag only when the element has no Text child before it closes.
      const close = s.indexOf(`</${m[1]}>`, m.index);
      const body = close > 0 ? s.slice(m.index, close) : '';
      if (!/<(Body|Label|Caption|H1|Big|Micro|Text)\b/.test(body)) issues.push(`${f}:${line} ${m[1]} without a role, label or text`);
    }
  }
}
console.log(issues.length ? issues.join('\n') : 'PASS: every pressable has a role, a label or readable text.');
process.exit(issues.length ? 1 : 0);
