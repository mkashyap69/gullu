# 05 · Plan engine and data

The engine is a **pure TypeScript package** (`src/engine/`) with no React or I/O imports, fully unit-tested. Screens call it through a small store layer.

## Starting point: the reference engine

`reference/engine.js` is a working JS port of the original single-goal engine. It is the regression baseline.

- `simulate(p, opt)` runs month by month for `years × 12` months. Each month:
  1. Applies events (expense draws from emergency → core → us → high → gold; money in; SIP pause).
  2. Step 1, safety net: fills the emergency fund to `expenses × monthsCover` (or pays an RD instalment for `rd12` / `rd24`).
  3. Step 2, gold: tops gold up to `goldPct` of invested total.
  4. Step 3, PPF: spreads the remaining yearly limit evenly over the months left until March (`mlf`). The year resets in April.
  5. Step 4, invest: splits the rest across `invest` buckets by gap to target share, then by share.
  6. Growth: monthly compounding at `(1 + annual%)^(1/12) − 1`. `marketShift` adjusts gold and equity returns.
  It returns rows (allocations, balances, tags) and milestone tags (`ef`, `gold`, `firstInv`, `goal`).
- `requiredSip(p)` finds the SIP that reaches the goal by bisection (36 iterations, ₹0–₹50 L) and rounds up to ₹500.

**Fixture A** (`reference/engine.test.js`, run `node --test reference/engine.test.js`) must pass unchanged after the port:

| Output | Value |
| --- | --- |
| Final invested total | ₹1,55,84,513 |
| Required SIP | ₹44,000 |
| Safety net full | May 2027 |
| Gold at target | Feb 2028 |
| First money into equity | Apr 2028 |
| Goal reached | Sep 2031 |
| RD 12 / RD 24 instalment | ₹22,792 / ₹11,011 |

Port it to TypeScript first, get Fixture A green in Jest, then extend.

## Extending to the v1 model

Keep the monthly loop and compounding. Generalise in this order, keeping Fixture A as a test that maps its fixed buckets onto classes and one goal:

1. **Classes, not buckets.** Holdings carry an `assetClass`. Returns, volatility and inflation are set per class (`assumptions`), not per holding.
2. **Goals list.** Each goal has `targetToday`, `inflation` (education and health default higher), `date`, `priority`, and a mix recomputed monthly from profile + horizon cap (`01-PRODUCT.md`).
3. **Flow rules as an ordered list** of step types: `safetyNet`, `costlyDebt` (rate threshold, default 12%), `commitment` (instrument, yearly cap, spread to 31 March — PPF, NPS, ELSS, SSY), `goals`. Goals are funded by priority, then by how far each is behind its required monthly.
4. **Required monthly per goal** using the bisection solver per goal. This gives the "needs ₹16,000" line.
5. **Holding split.** A holding can belong to several goals by % (sum to 100; unassigned → Retirement). Moves within a goal are split into that goal's holdings by the goal's mix.
6. **Ranges.** Monte Carlo: about 1,000 paths of monthly returns per class with a correlation matrix. 10th / 50th / 90th percentiles map to **Almost sure / Likely / Possible**. The single-line projection is the fast path for live sliders.
7. **Today's rupees.** Every output is also deflated by inflation. The UI shows today's rupees by default.
8. **Withdrawals.** Monthly outflows, the three-bucket refill each April (skip refilling income from growth in a down year), and "money lasts until age" read from the weak-markets path (Almost sure) and the median (Likely).
9. **Affordability word.** Comfortable means actual ≥ required and Almost sure ≥ target. Manageable means actual ≥ required. Stretch means actual < required. Tune the thresholds with the fixtures so Manish's goals come out as in the designs (Japan and Retirement Comfortable, Home Manageable, Education Stretch).
10. **Date range.** "Sep 2031 (Jun–Dec)" comes from the months at which the Possible and Almost sure paths cross the target.
11. **"Replay 2008" / "Replay 2020".** Apply the historical class returns from that year onward to today's plan. Store a small bundled table of annual Indian equity, global equity, gold and debt returns for those years.

**Budgets:** slider recompute ≤ 16ms on the single-line path; Monte Carlo off the JS thread, ≤ ~300ms on a mid-range Android. Seeded RNG so results are stable between runs and testable.

## Offline values and moments

- **Value update:** after each check-in, show one row per asset class, pre-filled with the engine's projected value. Store each confirmation as a `valueSnapshot`.
- **Stale:** a holding not updated for 60+ days shows the stale chip and feeds the "Value update" notification at 30 days.
- **Market-fall moment:** track `highWater = max(total invested across snapshots)`. When `(highWater − current) / highWater` crosses the profile threshold (10% default; 7% Cautious; 5% Safety-first), show 2.2 once. Re-arm only after a new high.
- **Concentration nudge:** any single *stock* above 10% of investing (excluding index and diversified funds) appears on Mix check.

## Data model (encrypted SQLite)

Use `expo-sqlite` built with SQLCipher via its config plugin (check the current Expo docs for the option name), or `@op-engineering/op-sqlite` with SQLCipher. Generate a random 256-bit key on first launch and keep it in `expo-secure-store`. Use migrations from day one (a simple versioned migrations table is fine; Drizzle ORM is a good fit).

```text
profile(id, name, age, work, dependents, paydayRule, stage, riskCapacity, riskTolerance, riskProfile, riskOverride, riskCheckedAt)
assumptions(class, returnPct, volatilityPct, preset)  + inflationPct, showTodayRupees
goal(id, name, template, targetToday, inflationPct, date, priority, isSafetyNet, isRetirement, status, createdAt)
flowRule(id, order, type, config_json, enabled)
holding(id, name, type, assetClass, isStock, planned, createdAt)
holdingGoal(holdingId, goalId, pct)
loan(id, name, ratePct, emi, balance, endDate)
valueSnapshot(id, date, holdingId?, assetClass?, value)            -- user-confirmed values
payday(id, month, amount, kind[same|less|bonus], placedAt)
move(id, paydayId, holdingId, goalId, planned, actual, doneAt)
scenario(id, name, changes_json, createdAt)
habit(id, kind[streak|shield|level|skin|challenge|minute], data_json, at)
settings(key, value)                                                -- hideAmounts, appLock, reduceMotion, haptics, notifications…
```

Export everything as JSON and CSV (Privacy screen). "Delete everything" drops the database, removes the key from secure store, cancels all scheduled notifications, clears widget data, and returns to Welcome.

## State

- `zustand` stores per domain (profile, goals, holdings, payday, habits, settings) hydrate from SQLite on launch and write through.
- Derived plan state (`usePlan()`) memoises engine output keyed by a hash of the inputs.
- No network layer exists. Add an ESLint rule banning `fetch`, `XMLHttpRequest` and `WebSocket` in `src/`, plus a CI grep, so it stays that way.
