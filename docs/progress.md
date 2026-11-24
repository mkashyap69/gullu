# Progress

Working log for the build. Each phase starts with a plan; items are ticked as they land. Deviations from the docs are listed with the reason.

## Decisions from the owner

- **Payday split (asked 24 Nov 2026):** each goal's monthly amount is the user's own choice (the "actual"). The engine computes "required" per goal and flags shortfalls ("₹3,500 more fixes it"). Priority order only decides who is cut first in a short month and who gets extra money. This keeps every design number.
- **2.2 Market fall copy:** "Your SIP buys more units…" → **"Your SIP gets more units while prices are low. Stopping it now is the usual mistake."** (CLAUDE.md bans "buy").

## Deviations and notes

- **Expo SDK 58** (RN 0.88, Reanimated 4.7, Worklets 0.13, Gesture Handler 3.3, Skia 2.14). `08-BUILD-PLAN.md` says SDK 57 "as of Nov 2026, check latest"; 58 is now the latest stable.
- Reanimated 4.7 needs the `ENABLE_SHARED_ELEMENT_TRANSITIONS` static feature flag for `sharedTransitionTag` (04-MOTION). Set in `package.json` → `reanimated.staticFeatureFlags`.
- `npx expo install` can't reach `api.expo.dev` from the build container, so versions were pinned from `expo/bundledNativeModules.json` and installed with npm. Run `npx expo install --check` on a machine with network to confirm.
- Routes live in root `app/` (as CLAUDE.md says), not the template's `src/app/`.
- Home goal: persona `date: '2031-09'` is the *projected* date; the goal's target date is **Dec 2031** (4.3 "Home · Dec 2031", 1.7 "Sep 2031, 3 months early").
- Per-screen gradients follow `02-SCREENS.md` where it differs from the role table in `03-DESIGN-SYSTEM.md` (e.g. 3.2 `violet`, 4.4 `ember`, 2.2 `dim`).

## Phase 0 · Scaffold

- [ ] Expo SDK 58 app in repo root, TypeScript strict, Expo Router, New Architecture, `expo-dev-client`
- [ ] Dependencies from the build plan
- [ ] `src/theme/tokens.ts` (copied from seed) and `src/theme/motion.ts` (from 04-MOTION)
- [ ] No-network ESLint rule (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`) + `scripts/check-no-network.sh` + GitHub Actions CI
- [ ] Inter bundled via `@expo-google-fonts/inter` (local TTFs, no CDN)
- [ ] `formatINR` + Jest tests (₹1,55,84,513 · ₹84.3 L · ₹2.4 Cr)
- [ ] Primitives: `ScreenBackground` (Skia gradient, cross-fade, ambient drift), text variants, `Amount`, `PrimaryButton`, `GhostButton`, `Pill`/`SegmentedPills`, `Row`, `GlassCard`, `TabBar`
- [ ] Dev primitives gallery (every primitive on every gradient)

## Phase 1 · Engine and data

- [ ] `src/engine/reference.ts`: line-for-line TS port of `reference/engine.js`; Fixture A in Jest, identical numbers
- [ ] v1 engine (`src/engine/`): classes + assumptions, goals with own inflation, profile mix + horizon caps + glide path, flow rules (safety net, costly debt, commitment, goals), required monthly per goal (bisection), holding split by %, today's rupees, Monte Carlo ranges (seeded, 1,000 paths, correlated classes), date range, affordability word, withdrawals + three buckets, Replay 2008/2020
- [ ] Manish test: Japan & Retirement Comfortable, Home Manageable, Education Stretch, "3 of 4 on track", Education needs ₹16,000
- [ ] Benchmark: single-line recompute < 16ms; Monte Carlo runs on a worklet runtime (off the JS thread)
- [ ] Encrypted SQLite (SQLCipher via `expo-sqlite` plugin, 256-bit key in `expo-secure-store`), versioned migrations
- [ ] zustand stores (profile, goals, holdings, payday, habits, settings) hydrate from SQLite and write through
- [ ] Dev switch: "Load demo data: Manish / Sunita"

## Phase 2 · Gullu and the motion kit (review gate)

- [ ] `<Gullu expression skin size />` in Skia, part by part from `reference/gullu.js`
- [ ] Animation library: idleBreathe, blink, lookAt, land, catchCoin, hop, wave, celebrate, spin, setExpression, setSkin, stretchPull, sleepy, concern
- [ ] `<Particles>`, `<GoalRing>`, `<Dial>`, `<Bubble>`, `<RangeBand>`, odometer `<Amount>`, `haptics.ts`, reduced-motion plumbing
- [ ] Motion lab with the six signature moments + reduced-motion toggle
- [ ] Screen recordings on Android release build (needs a device; owner review)
