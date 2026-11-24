# 08 · Build plan

Build in phases. Each phase ends with something that runs, passes its checks, and is committed. Don't start a phase until the previous one's acceptance list is green.

## Phase 0 · Scaffold
- `npx create-expo-app@latest money-plan` on the latest **stable** Expo SDK (SDK 57 / React Native 0.86 as of Nov 2026; check `docs.expo.dev/versions/latest`). TypeScript strict, Expo Router, New Architecture (required by Reanimated 4).
- Use **development builds** (`expo-dev-client`), not Expo Go: SQLCipher, widgets and Skia all need native code.
- Install: `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `@shopify/react-native-skia`, `expo-haptics`, `expo-linear-gradient`, `@expo-google-fonts/inter` + `expo-font`, `expo-sqlite`, `expo-secure-store`, `expo-local-authentication`, `expo-notifications`, `expo-sharing`, `zustand`, `@gorhom/bottom-sheet`. Dev: Jest + `@testing-library/react-native`, ESLint, Prettier, Maestro.
- Copy `seed/theme/tokens.ts` → `src/theme/tokens.ts`, and create `src/theme/motion.ts` from `04-MOTION.md`.
- Add the no-network lint rule (`no-restricted-globals` / `no-restricted-syntax` for `fetch`, `XMLHttpRequest`, `WebSocket`) and a CI grep.
- Build primitives: `ScreenBackground`, text variants, `Amount` (with `formatINR`), `PrimaryButton`, `GhostButton`, `Pill`, `Row`, `GlassCard`, `TabBar`.
- **Accept:** the app boots to a primitives gallery screen (dev only) showing every primitive on every gradient; `formatINR` is unit-tested (₹1,55,84,513 · ₹84.3 L · ₹2.4 Cr).

## Phase 1 · Engine and data
- Port `reference/engine.js` → `src/engine/` in TypeScript. Port `reference/engine.test.js` to Jest. **Fixture A must match exactly.**
- Extend per `05-ENGINE.md` steps 1–9 (goals, classes, flow rules, required per goal, holding split, ranges, today's rupees, withdrawals, affordability). Add tests that reproduce the Manish numbers in `seed/fixtures/personas.ts` closely enough that the status words and on-track counts match the designs.
- Encrypted SQLite, migrations, zustand stores, "Load demo data: Manish / Sunita" dev switch.
- **Accept:** `npm test` is green; engine single-line recompute < 16ms in a benchmark test; the Monte Carlo of 1,000 paths runs off the JS thread.

## Phase 2 · Gullu and the motion kit (review gate)
- `<Gullu expression skin size />` in Skia, ported part by part from `reference/gullu.js`, with the full animation library in `04-MOTION.md`.
- `<Particles>`, `<GoalRing>`, `<Dial>`, `<Bubble>`, `<RangeBand>`, odometer `<Amount>`, `haptics.ts`, reduced-motion plumbing.
- Prototype the **six signature moments** in a dev "Motion lab" screen: Payday catch, The answer, Ring → detail, Check-in → receipt, Level up, Market fall.
- **Accept:** a screen recording of each signature moment at 60fps on Android (release build), plus the reduced-motion version. **Stop here and show the recordings to the owner before building the full screens.**

## Phase 3 · Onboarding (1.1–1.7)
- Ends by writing a full profile, goals, holdings and monthly amount, and computing the plan.
- Notification permission pre-prompt after 1.7.
- **Accept:** a Maestro flow runs from a fresh install to Home with Manish's inputs, and the Answer screen shows "3 of 4 goals are on track".

## Phase 4 · Home and Goals (2.1–2.3, 3.1–3.5)

## Phase 5 · Payday loop (4.1–4.7) + value update
- **4.4b Value update** isn't designed yet. Build it in the system: after Check-in, a `night` screen titled "Quick value check." with one row per asset class pre-filled with the projected value, "Looks right" (primary) and tap-to-edit on each row. It takes about 20 seconds. Feeds the market-fall detection and the stale nudges.

## Phase 6 · Wealth (5.1–5.6) and What if (6.1–6.3)

## Phase 7 · You (8.1–8.5)
- App lock with `expo-local-authentication` (on resume after 60s in background), Hide amounts, export JSON/CSV via the share sheet, delete everything with hold-to-confirm.

## Phase 8 · Retiree mode (7.1–7.3)
- Driven by `work = retired` or stage = Retiree. The tab becomes Income. Load the Sunita demo to check.

## Phase 9 · Habits (10.1–10.6)
- Rules in `06-HABITS.md`. Wire the Home chip, the Receipt lines and the You row.

## Phase 10 · Notifications and widgets (9.x)
- Rules in `07-NOTIFICATIONS-WIDGETS.md`.

## Phase 11 · Polish
- Run the motion QA checklist on every screen.
- Accessibility pass (VoiceOver/TalkBack labels, dynamic type, contrast).
- Performance pass on the low-end Android target.
- **Screenshot comparison:** a dev script captures each screen with the Manish demo data at 390×844 and puts it next to `design/screens/<id>.png` in an HTML report.
- App icon and splash: Gullu `happy` on the `dusk` gradient. The splash hands off into the Welcome `land` animation.

## Definition of done for every screen
- [ ] Matches its PNG in `design/screens/` (layout, copy, colours), with the "Known design fixes" in `02-SCREENS.md` applied.
- [ ] Copy is verbatim from `02-SCREENS.md` (data values come from the store, not hard-coded).
- [ ] Motion matches its **Motion** line and passes the motion QA checklist.
- [ ] Works with Hide amounts on, reduced motion on, and 1.3× text.
- [ ] Navigation targets match **Goes to**.
- [ ] No network access, no console warnings, types strict.
