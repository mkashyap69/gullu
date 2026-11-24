# Running the Motion lab

The Phase 2 review gate: Gullu and the six signature moments, before any real screens are built.

## On an Android phone (the review target)

Needs Android Studio (SDK + platform tools), a phone with USB debugging on, Node 22.

```bash
npm install
npx expo prebuild --clean
npx expo run:android --variant release
```

The app opens on the dev hub. Tap **Motion lab**.

For a dev build with fast refresh instead:

```bash
npx expo run:android
npx expo start --dev-client
```

iOS is the same with `npx expo run:ios --configuration Release` (needs Xcode).

## What to look at

| Moment | Where | Watch for |
| --- | --- | --- |
| 1 · Payday catch | Motion lab → 1 | Coin arc into the slot, squash on contact, heavy haptic, ₹55,000 count-up, five bubbles 80ms apart with light ticks, each bobbing on its own phase |
| 2 · The answer | Motion lab → 2 | 60-tick hue sweep, 0 → 3 of 4, coin burst, rows cascade with a colour sweep, Education pulses amber once, disclaimer last |
| 3 · Rings to detail | Motion lab → 3, then tap a ring | Rings fill staggered, Gullu watches the payday bar, pull down to stretch him; ring zooms into the chart, line draws then the band settles. Scrub the chart (haptic on each year). Press and hold "Add ₹3,500 a month" to see the band lift |
| 4 · Check-in to receipt | Motion lab → 4, tick all 7, Done | Check draws, row slides 4px and dims, count rolls, ring advances; Gullu hops and Done pulses on the last tick; receipt lines ratchet out of the slot, streak cells fill, level card shimmers |
| 5 · Level up | Motion lab → 5 | Dim, land, spin (gold rim appears while he's turned away), rim draws on, shine sweep, coins and marigolds fall, success haptic |
| 6 · Market fall | Motion lab → 6 | Slow 1.2s line draw, band fades in behind, Gullu calm, "Keep going" breathes, **no haptics at all** |

Every moment has **Replay** at the top left.

Switches on the Motion lab screen:
- **Reduce animations** — the reduced-motion set (cross-fades, everything drawn, no particles; Gullu still blinks). Also follows the phone's own setting.
- **Haptics** — global on/off.
- **FPS overlay** — UI-thread frames per second, top right.
- **Hide amounts** — every rupee figure masks to `₹ ••••••`.

Other dev screens from the hub: **Gullu** (all 8 looks × 7 expressions, a button for each animation), **Primitives** (every primitive on every gradient), **Demo data** (switch Manish / Sunita, see the engine's plan).

## Quick look in a browser (preview only)

```bash
npm run web:setup
npx expo start --web
```

Skia runs on a bundled CanvasKit; data is in memory. Haptics, Low Power Mode and the encrypted database are phone-only, and frame rates in a browser say nothing about the phone.
