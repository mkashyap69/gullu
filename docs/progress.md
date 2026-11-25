# Progress

Working log for the build. Each phase starts with a plan; items are ticked as they land. Deviations from the docs are listed with the reason.

## Decisions from the owner

- **Payday split (asked 24 Nov 2026):** each goal's monthly amount is the user's own choice (the "actual"). The engine computes "required" per goal and flags shortfalls ("₹3,500 more fixes it"). Priority order only decides who is cut first in a short month and who gets extra money. This keeps every design number.
- **Onboarding (asked 24 Nov 2026, before Phase 3):**
  - **First monthly split: by priority.** Commitments (PPF) and the safety-net top-up (its gap over 12 months) come off first; then each goal up to its required amount, must → should → nice, nearest date first; anything left goes to the goal furthest behind, else Retirement. The user edits per-goal amounts later.
  - **Existing holdings: the app suggests a split from the user's data; the user accepts or edits it** (replaced "auto-assign by horizon" the same day, see "Suggested split" below).
  - **Income and spending are asked on 1.2** (two new rows). Spending sizes the safety net; income feeds the EMI share in the capacity score.
  - **Missing content is drafted and flagged** (list below).
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

## Phase 3 · Onboarding (1.1–1.7) — built

Plan: pure engine pieces first (risk scoring, templates, holding auto-assign, priority split, plan builder) with tests; then the input components; then the seven screens plus the notification pre-prompt; then a browser run-through and a Maestro flow.

- [x] `src/engine/onboarding.ts`: life stage, risk questions + capacity/tolerance scoring (lower wins), goal templates by stage, auto-assign by horizon, priority split, `buildPlanInput`, retiree three-bucket spec. Tests: Manish scores Growth/Balanced → Balanced; builder stage pre-ticks the right goals; split adds up; retiree path; safety net first.
- [x] Migration 2: `profile.monthlyIncome`, `profile.incomeVaries`. Demo data now pins "today" (Apr 2028) in the database; real plans use the current month.
- [x] Components: `StepDots` (active dot 8 → 22px), `ScrubValue` (age wheel / amount dial with odometer digits and haptic ticks; tap to type), `AmountField` (Indian formatting as you type), `Slider`, `TickCircle` (check path draws), `OptionCard` (press + glow), `Sheet` (spring.gentle over a 60% scrim, drag to dismiss). `PrimaryButton` gained `disabled` and `testID`; `SegmentedPills` gained `testID`.
- [x] Screens (+ the split step above): `/onboarding/welcome` (land + wave twice), `about`, `risk` (5 questions slide; ₹10 L counts down to ₹7.5 L as the line drops), `goals` (ticks, dims, Gullu peeks and nods, edit sheet, add your own), `have` (mini bars, group sheets, loans slide in negative, coin drops into Gullu), `monthly` (drag or type the amount, raise slider, income-varies toggle; retirees: need + pension), `answer` (shared with the Motion lab; retirees get an income answer), `notify` (pre-prompt, then `expo-notifications` permission).
- [x] Routing: a fresh install opens Welcome; a saved plan opens `/home`. `/home` shows the Phase 2 Home prototype until Phase 4. The dev hub moved to `/dev` (a "Dev tools" link on Welcome in dev builds only).
- [x] Browser run-through with Manish's inputs, start to Home, and the retiree path: no errors.
- [x] `.maestro/onboarding-manish.yaml`: fresh install → Home with Manish's inputs. **Not run yet** (Maestro needs a device/emulator).

### Suggested split of existing money (owner direction, 24 Nov 2026)

"Smart enough to decide from the user's data; the user can accept or edit." This replaces the first auto-assign rule.

- **Engine** `src/engine/suggestSplit.ts`:
  1. Cash, then debt, fills the safety net.
  2. PPF, EPF and NPS stay with Retirement (locked until then anyway).
  3. Everything else starts with Retirement; a chunk moves to another goal only if it lowers what the whole plan needs each month (the goal's relief minus what Retirement loses, must goals weighted a little higher).
  4. Chunks are shaped like the goal's own mix. Goals under 3 years take safe money only; goals under 7 years never exceed their equity cap against the safe money they hold; goals 7+ years away may use equity where safe money has run out (existing portfolios often carry more equity than the plan's mix, and new money brings it back, 5.2).
  5. It stops as soon as the monthly amount covers every goal, or when no move helps. Nothing is over-funded.
- **Screen** `/onboarding/split` (after 1.6, only when there is planned money; not for retirees): "Here's how I'd use what you have." Each goal shows its amount, why ("Needs ₹X a month instead of ₹Y", "Covered. No new money needed", "Grows best from new money"), and a share bar. Tap a goal to change its amount (capped by what fits its mix, with a live "Then it needs ₹X a month"); the rest rebalances to Retirement. "Looks right" saves; "Go back to my suggestion" undoes edits. Edits are dropped if the inputs they were made for change.
- **Manish (dated Apr 2028): 3 of 4 on track.** Home can only take ₹10.3 L (it's under 5 years away and he has little safe money), Education takes ₹30.8 L of equity and is covered, the trip takes ₹2.5 L, Retirement keeps ₹27 L plus PPF and EPF. The plan then needs ₹43,400 a month against ₹42,500, so the nice-to-have Japan trip is the one left short. (The designs' version has Education short; no rule reproduces that hand-picked split.)
- The Maestro flow asserts the shape of the answer, not the count: the count depends on the month it runs in, because PPF is spread to 31 March (in November ₹30,000 of the ₹55,000 goes to PPF).

### Open issue
- Onboarding assumes nothing has been paid into PPF this financial year, so late in the year the PPF catch-up takes a big share of the monthly amount (₹30,000 of ₹55,000 in November). Phase 5's flow rules (4.7) should ask "Paid into PPF since April?"; for now it's editable only there.

### Drafted content (needs owner review)
- **Risk questions 1, 2, 4, 5** and their answers (`RISK_QUESTIONS` in `src/engine/onboarding.ts`); scoring bands and points.
  - Q1 "How steady is the money that comes in each month?" · Q2 "If your income stopped, how long could your savings cover your expenses?" · Q4 "You put in ₹10 L for 5 years. Which would you pick?" · Q5 "Have you stayed invested through a big fall before?"
- **Goal templates**: default amounts and dates (Home ₹30 L in 44 months; Education ₹40 L at college in ~16 years; Travel ₹3 L, next October after 18 months; Car ₹8 L in 3 years; Wedding ₹15 L in 4 years; Parents' care ₹20 L over 10 years; Health corpus ₹25 L; Legacy ₹50 L; "My goal" ₹10 L in 3 years), their priorities and inflation; retirement spending defaults to current spending.
- **1.2**: "Take-home pay a month", "Spending a month"; retired helper "Got it. Next, I'll plan the income you take each month."; payday row hidden for retirees.
- **1.4**: "+ Add your own"; "Every plan keeps a safety net and retirement. You can change their amounts." (safety net and retirement can't be unticked: 01-PRODUCT makes them part of every plan, which overrides "Untick any").
- **1.5** sheet labels (Indian equity funds, International funds, Goes into EPF each month, Savings and liquid funds, Debt funds and FDs, NPS/Property/Crypto/Other/A loan, Still to pay, EMI a month, Interest rate) and "Today's value is fine. You can split it by fund later."
- **1.6**: income-varies "on" line "Payday now follows money in. Tell me when it lands and I'll split it."; retiree screen "How much do you need each month?" / "In today's rupees. I'll plan it to rise with prices." / "Pension and other income".
- **Split step**: "Here's how I'd use what you have." / "Short goals get safe money, long goals keep growing. Tap a goal to change it." / reason lines / "From what you have" / "Up to ₹X fits this goal's mix." / "Then it needs ₹X a month." / "Looks right" / "Go back to my suggestion" / the summary line.
- **1.7** status "Needs ₹X more a month" when a short goal's gap is under ₹1 L.
- **1.7** body for other cases: "Every goal is on track.", "{n} goals need ₹X more a month between them.", "Your safety net fills first."; status "Covered by what you have".
- **Retiree answer** (uses 7.1's wording): its growth-bucket return is a rough draft and says "likely until 105" for Sunita's numbers (persona: 98). Calibrate in Phase 8.
- **Notification pre-prompt**: "Want a nudge on payday?" / "I'll remind you when money lands and when it's placed. At most 2 a week, never about markets. They're made on this phone, nothing is sent anywhere." / "Turn on reminders" / "Not now".

### Notes
- Web preview draws the background with CSS (`ScreenBackground.web.tsx`): browsers cap WebGL contexts and Skia uses one per canvas. Phones keep the Skia background.
- Step dots: 5 for workers (about, risk, goals, have, monthly), 4 for retirees (no goals step) — Known design fix 6, and "Retired changes the step count".

## Phase 4 · Home and Goals (2.1–2.3, 3.1–3.5) — built

Plan: engine for the one-time moments and glide steps (tests first), then the five tabs with the custom tab bar, then the eight screens, then a browser tour with the Manish demo and a Maestro flow.

- [x] `src/engine/moments.ts` + tests: market fall from the highest recorded total (10%; 7% Cautious; 5% Safety-first), once per high, re-armed by a new high; "inside their range" = within a bad year for the profile (equity share × 15% × 1.645, about 15% for Balanced); milestones (6/12 paydays, safety net full, ₹1 Cr) once each; goal day when a goal's money reaches its target; glide steps (60 → 40 → 20%). Shown moments are stored as habit events (`kind: 'moment'`).
- [x] Tabs (`app/(tabs)`): Home · Goals · Payday (Income for retirees) · Wealth · You, with the animated `TabBar`. **Known design fix 4:** pushed screens sit above the tabs, so the tab bar hides on them. Payday (Phase 5), Wealth (6) and most of You (7) are placeholders; You already has Hide amounts, Reduce animations and Haptics.
- [x] 2.1 Home: headline and focus line from the plan, level/streak chip, rings (Known design fix 1: "Education"), payday bar that glows while Gullu watches it, pull-to-stretch that recomputes the ranges, one pending moment per visit (goal day → market fall → milestone).
- [x] 2.2 Market fall (`/market-fall`), from the Motion lab prototype, now driven by the engine; no haptics.
- [x] 2.3 Milestone (`/milestone?kind=`): confetti, count-up, success haptic, static in reduced motion.
- [x] 3.1 Goals: soonest first, date ranges, required vs actual with a dual bar and ghost marker, Stretch dot pulse, safety net last, reached goals listed, long-press reorder (`ReorderList`: lift, neighbours slide, haptic per slot) saved as a custom order.
- [x] 3.2 Goal detail (`/goal/[id]`): shared-element from the ring, fan chart, live preview on press, "Add ₹X a month" confirm sheet that raises the goal and the monthly total; the mix line shows the goal's horizon-capped mix and opens 3.4; "Edit goal"; "What if" opens a Phase 6 placeholder.
- [x] 3.3 Edit goal (`/goal/edit`): template chips with snap, editable name, rolling amount, date slider, priority pills, cap note that animates when the horizon crosses a band; retirement (age, spending) and safety net (months) variants; remove with confirm; rolls a reached goal's money into a new goal.
- [x] 3.4 Glide path (`/goal/glide/[id]`): step chart draws year by year, today marker drops with a bounce, steps light up in turn.
- [x] 3.5 Goal day (`/goal/day/[id]`): ring completes and bursts into coins; move to cash (goal marked reached), mark as spent (its share leaves each holding), or roll into a new goal.
- [x] Browser tour with the Manish demo (`?demo=manish` in the web preview): every screen above, no errors.
- [x] `.maestro/home-goals-manish.yaml` (needs a device; not run).

### Decisions and notes
- **Reorder vs "soonest first":** long-press reorder saves a custom order (`customGoalOrder`), and the subtitle then reads "In today's rupees, in your order." (drafted). The engine's funding order is unchanged (priority, then how far behind).
- **"Add ₹X a month"** on 3.2 raises the goal's amount and the monthly total together, via a small confirm sheet (drafted copy). The full Apply sheet (6.2) is Phase 6.
- Moments are checked when Home gains focus, 1.6s after it settles, at most one per visit.
- Share buttons ("Share it, amounts hidden") don't do anything yet; share cards are part of Phase 9.

### Drafted copy (Phase 4)
- Home chip with no level yet: "Your first payday starts a streak"; body when every goal is on track: "Every goal is on track."; small gaps: "{goal} needs ₹X more a month to stay on track."
- Market fall beyond a bad year: "About X% down. That's a bigger fall than your plan usually expects, but nothing needs selling. Your goals have time to recover."
- Milestones other than 12 paydays: 6 paydays ("Half a year without missing a month. That habit is what moves every goal."), safety net full ("Your safety net is full." / "Months of spending, ready any time. From now, payday money flows on to your goals."), ₹1 Cr ("₹1 Cr put to work." / "Built one payday at a time. Gullu is proud of the habit, not the market.").
- Goals list: "₹X a month, needs none", "No new money needed", safety net "₹X to go", "Reached {month}", custom-order subtitle.
- Goal detail: "Edit goal", add sheet ("Add ₹X a month to {goal}?" / "Each payday then puts in:" / "Add it" / "Not now").
- Edit goal: cap notes for 3–5, 5–7 and 7+ years; retirement "Spending a month, in today's rupees" / "I'll plan for it to last until 85."; safety net "Months of spending" / "That's ₹X in cash or liquid funds, ready any time."; "Remove this goal" / "Remove it for good".
- Glide path body for other steps ("From {month} the goal is under 5/7 years away, so new money moves its mix down to N% equity. Nothing is sold to do it.") and when already under 3 years.
- Goal day for non-travel goals: "Move it to cash, ready to use".

---

# Phases 5–11 (owner: "build phase 5–11 in one go", 25 Nov 2026)

Worked phase by phase, each with engine tests where there is logic, a browser run-through, and its own commit.

## Phase 5 · Payday loop (4.1–4.7) + value update — built

- [x] `src/engine/payday.ts` + tests: the month's lines in flow-rule order (safety-net top-up, costly debt, commitments spread to 31 March, each goal's own amount). **Short month (4.6):** the safety net and must-have goals keep their full amount first, then flow-rule order; a commitment that gets less "catches up later" (₹35,000 gives Home 18,000 · Education 12,500 · PPF 4,500 · Retirement and Trip next month, as designed). **Bonus:** extra goes to the goal furthest behind, must first, else Retirement. Moves into holdings follow each goal's mix (one holding per class per goal; funds before single stocks; the user's preferred holding wins), add up to the exact payday, PPF first.
- [x] `src/engine/habits.ts` + tests: streak with shields (one every 6 placed months in a row, max 1 held, covers one missed month; the current month never breaks a streak), festival looks (Diwali and Holi months 2026–2031, bundled), the six levels with progress and the one thing blocking the next ("11 of 12 paydays · Education needs ₹3,500 more").
- [x] Data: migration 3 (move class and parts); check-in moves saved per month, so a check-in can be finished later; preferred holdings; PPF paid this financial year with its year (`paidFy`), resetting each April.
- [x] `src/state/payday.ts` + a store test of the whole loop: `startPayday` → ticks → `placePayday` (holdings and loans move by what actually went in, PPF records its payment, payday placed, shields used, festival looks, levels unlocked in order, once each, never down, newest look worn) → `confirmValues` (classes scaled to the confirmed values, a snapshot per holding plus the total).
- [x] Screens: Payday tab (the payday moment when money has landed; between paydays: next date, the split, flow rules, "It landed early"; variable income: "Money in?"), 4.3 Why this amount (shared element from the bubble, bars in sequence, shared-holding split ring, pick a different holding of the same kind), 4.4 Check-in (saved ticks, tap an amount to correct it), 4.4b Quick value check, 4.5 Receipt (real streak, shield, festival, next-level card or "Level N unlocked" → 10.2), 4.6 Short month, 4.7 Flow rules (drag to reorder, toggles, PPF "paid since April" and yearly amount, add ELSS/SSY/RD/NPS). 4.1 in-app: the payday bar slides in with a coin drop. Notifications are Phase 10.
- [x] Browser run of the loop with the Manish demo: no errors.

### Decisions and notes (Phase 5)
- **Known design fix 2** applied: "Show me the moves".
- **Costly debt** isn't sized anywhere in the docs. Draft rule: while a loan is above the threshold, half of what's left after the safety net goes to prepaying it (`COSTLY_DEBT_SHARE`). Manish's car loan (9.2%) is below 12%, so it doesn't apply to him.
- **Why this amount numbers** differ from 4.3: the glide path sends Home's new money to debt first because its equity is over its 40% cap (₹14,400 short-term debt, ₹3,300 S&P 500, ₹300 liquid), where the design shows a target-mix split.
- **Shield timing:** 10.4 says "Next shield in October" for Manish; under 06-HABITS's rule (every 6 placed months in a row) his next shield arrives in March. The rule wins.
- **Done** on check-in places what was ticked; unticked moves wait. Done is disabled until at least one is ticked.
- The market-fall "Update values" link opens the value check on its own.
- The demo persona's ₹74.8 L confirmed total doesn't match its own holdings (₹86 L), so confirming values in the demo clears the market fall. That's the persona data, not the engine.
- 8.3's copy says "Usage stats never include amounts", but the app has no usage stats at all (no analytics, by rule). Kept verbatim for now; worth rewording.

### Drafted copy (Phase 5)
- Payday line for other cases ("Your safety net comes first…", costly loan, no loans); between paydays ("Next payday: 1st May.", "Here's where it will go when it lands.", "Money in?", "Log money in", "It landed early", "See April's receipt", "Where your money goes first / Flow rules").
- 4.3 for non-must goals, commitments, safety net and debt; "Which of yours should take it?", "Chosen", "Let me choose again each month", "Add another holding of this kind in Wealth to have a choice."
- 4.4: "Done places what you ticked. The rest can wait for next month.", amount sheet "What went in" / "Planned ₹X."
- 4.4b: "I've filled in where your money should be by now. Change any that look off, from your apps.", "Skip this month", "Values stay on this phone. Nothing is fetched from the internet."
- 4.5: "Gullu earned a Diwali 2027 look.", "Level N unlocked. {Name}: tap to see Gullu's new look.", unlock lines for blockers other than a goal.
- 4.6: bonus and same-amount lines, "How much came in?".
- 4.7: commitment sheet ("Each year", "Paid since April", "The rest is spread evenly over the months to 31 March."), add sheet, the closing note.

## Phase 6 · Wealth (5.1–5.6) + What if (6.1–6.3) — built

- [x] `src/engine/wealth.ts` + tests: net worth (₹87.4 L own, ₹3.1 L owe, ₹84.3 L), mix check against the goals' combined target (each goal's horizon-capped mix weighted by its money) and months of new money to fix drift without selling, single-stock nudge above 10% (index funds and stock groups never flagged), EMIs left, prepay-or-invest, planned money by class month by month, holding split that pushes the other shares.
- [x] `src/engine/scenario.ts` + tests: No income N months (contributions pause; spending comes from the safety net, then Retirement money), Replay 2008/2020, Retire at N, Fix off-track goals, Prepay a loan. Before/after per goal on the fast single-line path; headline; what can be applied; card lines for 6.3. **Design case reproduced:** 6 months without income → "Most goals slip a little. None break.", Home Dec 2031 → Mar 2032.
- [x] Data: migration 4 (`isGroup` on holdings, e.g. "4 US stocks"), scenarios saved; remove holding/loan.
- [x] Screens: 5.1 Net worth (count-up, sparkline, Hide amounts), 5.2 Mix (bars grow, drift note), 5.3 Holdings (by class, stale value badge after 60 days, add/edit sheet), 5.4 Loans (prepay vs invest: solid "for sure" bar vs fuzzy "likely" band; add/edit/paid off; "Try it in What if"), 5.5 Timeline (stacked area in Skia, play ≈4s, scrub snaps to months with a tick), "See your year in money" recap, 5.6 Holding split (donut, shares push each other, the rest counts towards Retirement), 6.1 What if (chips, sliders, strike-through before, slide-in after, rewind shimmer), 6.2 Apply sheet (collapses into a check, then Home), 6.3 Scenarios (pick up to 3 with a lift, compare side by side).
- [x] Browser run with the Manish demo: no errors.

### Decisions and notes (Phase 6)
- **Slip vs break (6.1):** the design shows Home slipping past its date while "None break". Goals whose date can move (home, trips, car, custom) show when they'd be reached; fixed-date goals (education, wedding) show how short they'd fall. A goal "breaks" only when a fixed-date goal that was on track falls short, or a chosen retirement age can't be met.
- Our numbers for the design's case: Education ₹6 L → ₹7 L short (design ₹9 L), Retirement at 58 → 58 (design 56 → 57). Retire at 55 needs ₹9,500 more a month (design ₹9,000). Same shape, persona data differs.
- **Timeline** runs from next month for 5 years; the demo's "today" is Apr 2028, so its axis is May 2028–Apr 2033, not the design's Dec 2026–Nov 2031. New motion token `signature.timelinePlay` (4000 ms).
- **Year in money** never auto-advances (no timers): tap to go on.
- **Apply** only changes lasting settings (monthly amounts, retirement age). No-income and replay scenarios can be saved but not applied.
- "Fix off-track goals" and "Prepay {loan}" chips appear only when there's an off-track goal or the user came from Loans.

### Drafted copy (Phase 6)
- 5.4: "No loans." + body, "Edit this loan", "+ Add a loan", "It's paid off", loan sheet labels, the above-the-line note ("…so the plan prepays it first. Your call.").
- 5.5 recap: "Your year in money.", "Tap to go on.", "You placed N paydays.", "went into your goals.", "That's a N-month streak.", "Your planned money / was / and is now", "New money and market moves together. Markets go both ways.", "Same plan, one more year."
- 6.1: other headlines ("One goal would need help.", "A goal slips a little. None break.", "Your goals move closer.", "Nothing moves. Your plan takes it."), the no-income note past the safety net, the replay note, "Stop working at", "Prepay from savings", "These monthly amounts put every goal on track."
- 6.2: "Nothing here to apply." + body, "Applied".
- 6.3: card lines ("No income for N months", "N years earlier", "Markets like 2008, from now", "+₹X a month", "Home slips N months", "Needs ₹X more a month", "All goals still reached"), "Name this scenario", "Pick 2 or 3", "Side by side", "Back to scenarios", empty state.

## Phase 7 · You (8.1–8.5) — built

- [x] 8.1 You: name, age, stage, work, dependents; risk profile card with an animated five-segment meter and ghost markers for capacity and answers; rows to Levels, Retake the risk check (re-scores the saved profile from the 1.3 questions and returns), Change risk profile, Assumptions, Privacy, Notifications (9.3, Phase 10), Learn.
- [x] 8.5 Too aggressive: choosing a profile above the lower of capacity and answers opens the warning sheet first (Gullu concerned, "Stay Balanced" primary). Lower is applied straight away; choosing the suggested one clears the override.
- [x] 8.2 Assumptions: Cautious / Base / Optimistic presets roll every value together; tap a value to set your own (±0.5, shows "Your own"); Show today's rupees; the disclaimer. `src/engine/assumptions.ts` + tests.
- [x] 8.3 Privacy: App lock (Face ID / fingerprint / phone PIN via expo-local-authentication; locks at launch and after 60s away; covers the app in the switcher), Hide amounts by default, encryption shown as always on, Export (JSON of everything, or CSV of holdings and goals, through the share sheet; the file is deleted after), Delete everything (2s hold ring; drops the encrypted database and its key, back to Welcome).
- [x] 8.4 Learn: flip cards (rotateY; cross-fade with reduced motion), 4 shown, "See all 24".
- [x] Browser run: no errors. Typecheck, 62 tests, lint, network check pass.

### Decisions and notes (Phase 7)
- **Preset values** for Cautious and Optimistic aren't in the docs. Drafted: Cautious = equity −2, other classes −1, inflation +1; Optimistic = equity +1, others +0.5, inflation −0.5. Base keeps the engine's defaults (cash 5.5%, where the 8.2 PNG shows 6%; Fixture A depends on the engine defaults).
- **Show today's rupees off** switches Goal detail's headline and range to the goal year's rupees. Other screens keep today's rupees for now (noted for Phase 11).
- **Motion and haptics** row added to You (reduce animations, haptics) since these settings needed a home; the phone's own reduce-motion setting always wins too.
- **8.5 when goals aren't all on track:** the design line "your goals are on track with it" would be untrue, so a drafted variant is used.
- 8.3 still says "Usage stats never include amounts" verbatim; the app has no usage stats (see Phase 5 note).
- App lock isn't testable in the web preview (no device authentication); the lock never engages there.

### Drafted copy (Phase 7)
- 8.1: other risk explanations ("Your capacity and your answers both say X.", "You chose X. Your answers say Y and your capacity says Z."), "App lock is off", "Off", "Five questions", "Your first payday starts it", risk sheet ("Change risk profile", "Your answers and capacity suggest X. Lower is always fine.", "· suggested"), "Motion and haptics" sheet.
- 8.5 variant: "Your answers said X. Y means deeper falls in bad years. A little more each month is the steadier way to close a gap."
- 8.2: "Your own", value sheet note "A yearly average over many years. Real years will be higher and lower."
- 8.3: hold hint, export sheet ("The file goes to your phone's share sheet…", "Everything, as JSON", "Holdings and goals, as CSV"), "Set a screen lock first." sheet, lock screen ("Money Plan is locked.", "Your plan stays private until you unlock it.", "Unlock").
- 8.4: 20 of the 24 explainers (all but SIP, Glide path, PPF, Drawdown).
- Goal detail with today's rupees off: "In {year} rupees, with prices rising N% a year."

## Phase 8 · Retiree mode (7.1–7.3) — built

- [x] Driven by `work = retired`: Home becomes 7.1 Income plan, the Payday tab becomes Income (7.3), Wealth becomes 7.2 Three buckets (with a Holdings row).
- [x] `src/engine/income.ts` + tests: income plan (spend, pension, from savings, withdrawal rate, likely and almost-sure ages, buckets, April refill) and "I've withdrawn it" (cash holding pays the month; in April the refill moves from debt holdings, in proportion, into cash).
- [x] **Calibration:** the retiree spec no longer uses a draft growth return. The growth bucket holds the profile's long-run mix without its cash share; its return is the weighted class return after fund costs, and its volatility uses the class correlations. For Sunita (Cautious) that's 8.75% and 6.2%, which gives **likely until 98, almost sure until 91** and buckets ₹15.6 L / ₹39 L / ₹1.85 Cr straight from her inputs, with no tuning. The onboarding retiree answer now says 98 too (was 105).
- [x] Screens: 7.1 (ages count from today's age, pension and savings bars grow on the calm timing, the weak/likely range bar), 7.2 (Skia jars fill and settle with a slow wave; a drop travels from income to cash for the April refill), 7.3 (amount counts, the withdraw row pours, refill row tickable in April, "I've withdrawn it" records the month).
- [x] Browser run with the Sunita demo: no errors.

### Decisions and notes (Phase 8)
- **Fund costs** of 0.4% a year are taken off the growth bucket's return (`FUND_COST_PCT`). Drafted; it's what makes the principled numbers match the persona.
- **₹1.85 Cr on 7.2** shows as ₹1.8/₹1.9 Cr: 03-DESIGN-SYSTEM's rule is one decimal in compact form, and the rule wins over the PNG.
- The Monte Carlo age (1,000 paths over ~46 years) runs a beat after first paint so the screen never waits for it; the headline shows the likely age first.
- **Refill is ticked separately** from the withdrawal: it's recorded only if the user says it moved.
- Jars grow with the square root of each bucket so the cash jar stays visible next to growth (the PNG's jar heights aren't proportional either).
- Retiree tabs keep the Goals tab as designed.

### Drafted copy (Phase 8)
- 7.1: "Good afternoon / Good evening", the over-4% line ("Over 4% draws savings down faster; the ages above already show it.").
- 7.2: Holdings row ("What's in each bucket, and its value").
- 7.3: "Tap once you've moved it.", "Done for {Month}. See you next month."
