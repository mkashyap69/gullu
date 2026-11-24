# Progress

Working log for the build. Each phase starts with a plan; items are ticked as they land. Deviations from the docs are listed with the reason.

## Decisions from the owner

- **Payday split (asked 24 Nov 2026):** each goal's monthly amount is the user's own choice (the "actual"). The engine computes "required" per goal and flags shortfalls ("₹3,500 more fixes it"). Priority order only decides who is cut first in a short month and who gets extra money. This keeps every design number.
- **2.2 Market fall copy:** "Your SIP buys more units…" → **"Your SIP gets more units while prices are low. Stopping it now is the usual mistake."** (CLAUDE.md bans "buy").

## Deviations and notes

- **Expo SDK 58** (RN 0.88, React 19.3, Reanimated 4.7, Worklets 0.13, Gesture Handler 3.3, Skia 2.14). `08-BUILD-PLAN.md` says SDK 57 "as of Nov 2026, check latest"; 58 is now the latest stable.
- Reanimated 4.7 needs the `ENABLE_SHARED_ELEMENT_TRANSITIONS` static flag for `sharedTransitionTag`; it's set in `package.json` → `reanimated.staticFeatureFlags` (applies at prebuild).
- **React Compiler is off** (`app.json` → `experiments.reactCompiler: false`). The Expo template turns it on, but Reanimated shared values are mutated by design (`sv.value = …`) and the compiler's hook rules treat that as a bug. ESLint's compiler-only rules (`react-hooks/immutability`, `react-hooks/refs`) are off for the same reason.
- `npx expo install` can't reach `api.expo.dev` from the build container, so versions were pinned from `expo/bundledNativeModules.json` and installed with npm. Run `npx expo install --check` on a machine with network to confirm.
- Routes live in root `app/` (as CLAUDE.md says), not the template's `src/app/`.
- Home goal: persona `date: '2031-09'` is the *projected* date; the goal's target date is **Dec 2031** (4.3 "Home · Dec 2031", 1.7 "Sep 2031, 3 months early").
- Per-screen gradients follow `02-SCREENS.md` where it differs from the role table in `03-DESIGN-SYSTEM.md` (e.g. 3.2 `violet`, 4.4 `ember`, 2.2 `dim`).
- **Web is a preview only.** `index.web.js` loads CanvasKit from `public/` (`npm run web:setup`) and `src/data/db.web.ts` keeps demo data in memory (no SQLCipher in a browser). Reanimated's web `entering` animations take the wrapper out of flow, so `Rise` skips them on web. iOS/Android are the product.

### Engine calibration (05-ENGINE.md step 9: "tune the thresholds with the fixtures")

Manish's status words, on-track count and required amounts now match the designs exactly. Choices made to get there, all in `src/data/demo.ts` / `src/engine/plan.ts`:

- **Affordability rule:** Stretch = actual < required. Comfortable = actual ≥ required **and** either Almost sure ≥ target, **or** the actual amount carries a 15% cushion over the exact required amount (`COMFORT_CUSHION`). Without the cushion no long-horizon goal could ever be Comfortable: Retirement's Almost sure path is far below its median after 26 years. Manageable otherwise.
- **"Likely" is the single line**, so a slider number and the band always agree; Monte Carlo supplies the spread (10th/90th percentiles relative to its own median).
- Defaults: returns cash 5.5 / debt 7 / IN equity 12 / global 11 / gold 8 %; volatility 0.5 / 2.5 / 15 / 14 / 12 %; inflation 6% (education 10%); yearly raise 10% (persona `yearlyRaisePct`); retirement corpus sized as an annuity to age 85 at a 2.5% real return.
- Demo holdings are split across goals so totals per class match the persona exactly (₹44.0 L / 21.3 L / 11.2 L / 6.5 L / 3.2 L / 1.2 L). EPF gets ₹7,200/month automatically from salary and never gets payday moves.
- **Known gaps vs the designs** (numbers, not words — revisit when building those screens):
  - Retirement "Could stop at **56**": the engine says **58**. A 20% cushion on ₹9,000 isn't enough to retire two years early under these assumptions.
  - Education bands: design 28 / 34 / 43 L; engine 25 / 34 / 50 L (Likely matches; the spread is wider at 15% equity volatility).
  - Home lands **Nov 2031** (design Sep 2031); Japan trip lands Jul 2029 (design shows its Oct 2029 date).
  - This month's moves: the same 7 holdings as 4.4 and they add up to exactly ₹55,000, but the split differs (the glide path sends new money to debt first because equity is over target, so ₹28,200 goes to the short-term debt fund). 4.3/4.4's numbers use the target mix instead. To settle in Phase 5.

## Phase 0 · Scaffold — done

- [x] Expo SDK 58 app in repo root, TypeScript strict, Expo Router, New Architecture, `expo-dev-client`
- [x] Dependencies from the build plan (+ `expo-crypto` for the DB key, `expo-battery` for Low Power Mode)
- [x] `src/theme/tokens.ts` (copied from seed) and `src/theme/motion.ts` (04-MOTION tokens + named derived values)
- [x] No-network ESLint rule (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, analytics/network packages) + `scripts/check-no-network.sh` + GitHub Actions CI
- [x] Inter bundled via `@expo-google-fonts/inter` (local TTFs, no CDN)
- [x] `formatINR` + Jest tests (₹1,55,84,513 · ₹84.3 L · ₹2.4 Cr), worklet-safe for count-ups
- [x] Primitives: `ScreenBackground` (Skia gradient, cross-fade, ambient drift), text variants, `Amount` (count-up, odometer, before → after, hide amounts), `PrimaryButton` (press, loading → check, breathe, pulse), `GhostButton`, `Pill`/`SegmentedPills`, `Row`, `GlassCard`, `Toggle`, `TabBar`, `Rise`
- [x] Dev primitives gallery (every primitive on every gradient): `/dev/primitives`

## Phase 1 · Engine and data — done

- [x] `src/engine/reference.ts`: line-for-line TS port; **Fixture A identical in Jest**
- [x] v1 engine: classes + assumptions, goals with own inflation, profile mix + horizon caps + glide path (no forced selling), flow rules (safety net, costly debt, commitment spread to 31 March, goals), required monthly per goal (bisection), holding split by % (unassigned → Retirement), today's rupees, Monte Carlo (seeded, 1,000 paths, correlated classes), date ranges, affordability words, withdrawals + three buckets, Replay 2008/2020
- [x] Manish tests: Japan & Retirement Comfortable, Home Manageable, Education Stretch, "3 of 4", Education needs ₹16,000 (₹3,500 more), Likely ₹34 L, short by ₹6 L
- [x] Sunita tests: likely until 98, almost sure until 91, 3.3% withdrawal rate, April refill
- [x] Benchmark test: single-line recompute < 16ms. Monte Carlo runs on a dedicated worklet runtime (`src/plan/runMonteCarlo.ts`); in plain Node the longest goal (Retirement, 348 months × 1,000 paths) takes ~115ms. **Needs measuring on the Pixel 6a-class target.**
- [x] Encrypted SQLite (SQLCipher via `expo-sqlite` plugin, random 256-bit key in `expo-secure-store`), versioned migrations, repo with JSON/CSV export
- [x] zustand stores (profile, goals, holdings, payday, habits, settings) hydrate from SQLite and write through; tested against in-memory SQLite
- [x] Dev switch: "Load demo data: Manish / Sunita" at `/dev/data`

## Phase 2 · Gullu and the motion kit — built, awaiting review

- [x] `<Gullu expression skin size />` in Skia, part by part from `reference/gullu.js` (aura, feet, morphing arms, body gradient, lid + knob, slot, highlight, band + beads, skin extras, face per expression). One Canvas per instance.
- [x] Animation library: idleBreathe, blink (random 3.5–6s, 20% double), lookAt, land (lid lags 40ms), catchCoin, hop, wave, celebrate (bead ripple), spin (face hidden edge-on), setExpression (face cross-fade + arm morph), setSkin (extras draw on, body cross-fade), stretchPull, sleepy (slow breathe + floating z's), concern (sweat drop slides once), shine sweep, diya flicker
- [x] `<Particles>` (coin/petal/dot, ≤ 60, frame-callback physics, one Skia picture per frame), `<GoalRing>`, `<Dial>`, `<Bubble>`, `<RangeBand>` (draw, band settle, morph, preview lift, scrub lens with year haptics), odometer `<Amount>`, `haptics.ts` (global setting + quiet scope), reduced-motion plumbing, ambient pause (focus, app state, Low Power Mode), FPS overlay
- [x] Motion lab with the six signature moments + reduced-motion / haptics / FPS / hide-amounts switches: `/dev/motion-lab`
- [x] Checked in a web preview (Playwright screenshots, normal and reduced motion; every Gullu animation, look and expression exercised without errors)
- [ ] **Screen recordings at 60fps on an Android release build** — needs a device (see `docs/MOTION-LAB.md`). Owner review gate.

### Phase 2 interpretation notes
- 1.7's design has no dial; the dial sweep around Gullu comes from 04-MOTION's signature moment and 03's `Dial` component.
- 4.4's design has no Gullu; a small Gullu sits next to "x of 7 done" so he can hop on the last tick.
- 2.2's design has no chart; a compact fall-inside-the-range chart sits in the values card so the calm line draw and band have somewhere to live.
- 4.5's "receipt slides out of a slot line by line": the slot is a thin line under Gullu, and each line of the receipt (title, streak, streak cells, level card) emerges from it with a ratchet haptic.
