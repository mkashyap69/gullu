# Money Plan: instructions for Claude Code

Money Plan is a goal-first investing planner for India: a **React Native (Expo) app, fully offline**, with a clay-gullak mascot called **Gullu** and rich motion throughout. The product, designs and rules are already decided. Your job is to build them faithfully and make them feel alive.

## Read first
1. `docs/01-PRODUCT.md`: what the app does and the rules it must never break.
2. `docs/08-BUILD-PLAN.md`: phases, acceptance criteria, definition of done. **Work phase by phase.**
3. Then, as needed: `docs/02-SCREENS.md` (every screen: image, copy, links, motion), `docs/03-DESIGN-SYSTEM.md`, `docs/04-MOTION.md`, `docs/05-ENGINE.md`, `docs/06-HABITS.md`, `docs/07-NOTIFICATIONS-WIDGETS.md`.

Visual truth is `design/screens/*.png`. Exact styles are in `design/html/*.dc.html`. Open the PNG for any screen before building it.

## Stack (don't swap without asking)
Expo (latest stable SDK, dev builds) · TypeScript strict · Expo Router · Reanimated 4 + react-native-worklets · Gesture Handler · React Native Skia · expo-haptics · encrypted SQLite (expo-sqlite + SQLCipher, key in expo-secure-store) · zustand · expo-notifications (local only) · expo-widgets (+ react-native-android-widget if needed) · Jest + Maestro.

## Non-negotiables
- **No network.** No `fetch`, analytics, crash reporting, remote config or CDN fonts. Bundle Inter. Lint and CI enforce this.
- **Never "buy" or "sell"** in any copy, and never name a fund, stock or scheme the user didn't add. The app shows "moves" into the user's own holdings. Keep the disclaimer on projection screens and shared cards.
- **Engine correctness first.** `reference/engine.test.js` (Fixture A) must pass against the TypeScript engine with identical numbers. Indian number formatting everywhere (₹1,55,84,513 · ₹84.3 L · ₹2.4 Cr) via one `formatINR` helper.
- **Motion system:** use only the tokens in `src/theme/motion.ts`. Continuous animation runs on the UI thread (worklets/Skia), never `setState` per frame. Every animated screen has a reduced-motion path. Calm motion and no haptics on the market-fall screen.
- **Ethical engagement:** no timers, prizes, leaderboards, social proof, guilt copy, or rewards for app opens. See the "Hard no" list in `docs/06-HABITS.md`.
- **Privacy:** everything is encrypted on device; Hide amounts must cover every rupee figure, including widgets, notifications and share cards.
- Copy in `02-SCREENS.md` is final. Use it verbatim, except for the listed "Known design fixes".

## How to work
- Before each phase, write a short plan in `docs/progress.md`; tick items off as they land. Note any deviation from the docs there with the reason.
- Prefer small, composable components in `src/components/`, screens in `app/` (Expo Router), engine in `src/engine/` (pure TS, no React imports).
- Run `npm run typecheck && npm test` before every commit. Commit at the end of each phase item with a clear message.
- **Stop and ask the owner** before: changing a product rule or the copy, adding any dependency that touches the network, changing the stack, or skipping a reduced-motion path. At the end of Phase 2 (Gullu + signature moments), stop and share screen recordings for review.
- If something in the designs conflicts with these rules, the rules win. Note the conflict in `docs/progress.md`.

## Useful commands
- `node --test reference/engine.test.js`: reference engine check (plain Node).
- `npx expo start --dev-client`: run the dev build.
- `npx expo prebuild --clean` after changing config plugins (widgets, SQLCipher).
