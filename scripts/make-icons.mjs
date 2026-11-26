// Renders the app icon, Android adaptive icon layers, splash image and favicon from the live Gullu
// drawing (dev route /dev/icon in the web preview). Run with the web preview on :8081.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const parts = [
  ['icon', 'assets/images/icon.png', 1024, false],
  ['fg', 'assets/images/android-icon-foreground.png', 512, true],
  ['bg', 'assets/images/android-icon-background.png', 512, false],
  ['mono', 'assets/images/android-icon-monochrome.png', 432, true],
  ['splash', 'assets/images/splash-icon.png', 512, true],
  ['icon', 'assets/images/favicon.png', 48, false],
];
const b = await chromium.launch();
for (const [part, file, px, transparent] of parts) {
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: px / 1024 });
  await p.goto(`${BASE}/dev/icon?part=${part}`, { waitUntil: 'load' });
  if (transparent) await p.addStyleTag({ content: 'html,body,div{background:transparent!important;background-color:transparent!important;background-image:none!important}' });
  await p.waitForTimeout(3500);
  await p.locator('[data-testid="art"]').screenshot({ path: file, omitBackground: transparent });
  await p.close();
  console.log(`✓ ${file}`);
}
await b.close();
