# 06 · Habits: the engagement layer

The goal is a habit people keep for years: **one payday a month, done well**. Every mechanic rewards something that improves the user's plan. Nothing rewards opening the app.

## Mechanics

### Payday streak (10.4)
- One cell per month. A month counts when the payday is placed (check-in done) within that month. **A short month still counts**: placing less than usual is fine.
- **Shield:** one shield is earned every 6 consecutive months and held (max 1). It automatically covers one missed month, so the streak survives. The UI says "Your shield covered September."
- A broken streak is shown neutrally ("New streak: 1 month"). No guilt copy, no "you lost your streak!".

### Levels (10.1, 10.2)
Levels follow **real financial progress**, never app opens. Evaluate them after every check-in and value update.

| Level | Name | Unlocks when | Gullu look |
| --- | --- | --- | --- |
| 1 | Starter | First payday placed | `base` |
| 2 | Steady | Safety net covers 3 months | `steady` (teal band) |
| 3 | Secure | Safety net full **and** no costly debt (above the flow-rule rate) | `secure` (gold rim) |
| 4 | Builder | 12 paydays on time **and** every goal funded at its required monthly | `builder` (marigolds) |
| 5 | Halfway | Investments cover half the retirement goal (today's rupees) | `halfway` (gold zigzag) |
| 6 | Free | Retirement goal fully covered | `free` (all-gold glaze) |

Note: Halfway and Free are measured **against the user's own retirement goal**, not years of expenses. Measuring by years of expenses would put Manish (₹83 L) past them already.

- The next level shows its progress and the **one thing blocking it** in plain words ("11 of 12 paydays · Education needs ₹3,500 more"). This is how the game points at the user's weakest goal.
- Level up (10.2) fires once per level, ever. Levels never go down. If the condition later lapses, the level stays but Home shows the issue as usual.
- Each level unlocks the look in the table, matching the tiles on 10.3 (Starter, Steady, Secure, then Level 4–6 locked).

### Gullu's looks (10.3)
- 6 level looks plus festival looks: **Diwali** (diya flame + marigolds) and **Holi** (colour splashes), unlocked by placing a payday in that festival's month. Each year's festival is a separate collectible ("Diwali 2027", "Diwali 2028").
- Festival dates are bundled in a table (offline). Ship 5 years of dates.
- **Looks can't be bought.** The user picks which one Gullu wears everywhere (Home, Payday, widgets).
- Locked looks show as silhouettes with "Level 4" or the festival name.

### Challenges (10.4, 10.5)
Self-chosen promises. Gullu only keeps count. At most 2 active at once.

| Challenge | Tracks |
| --- | --- |
| Raise my SIP 10% at my appraisal | The user picks the month; checks the monthly amount went up |
| Update values every month for 3 months | Value snapshots in 3 consecutive months |
| Learn 4 money cards this month | Money minute cards answered |
| No new loan this year | No loan added for 12 months |
| Put my bonus to work | A bonus payday split across goals |
| No skipped payday this quarter | Payday placed in each month of the quarter |
| Max PPF before 31 March | PPF contributions reach the yearly limit |

Finishing one gives a quiet check and a line in the receipt. **No prizes.**

### Money minute (10.6)
- 24 bundled question cards, one unlocked per week. One question, 3 options, an explanation, and a link to the related Learn card.
- A wrong answer shows the explanation kindly, with no penalty. It never affects levels or streaks.

### Recaps
- **Receipt (4.5)** after each check-in: streak, shield, next-level nudge.
- **Milestone (2.3)** for habit milestones: 6 and 12 paydays, safety net full, first ₹1 Cr invested, goal reached.
- **Year in money** (from Timeline 5.5): a story-style recap of the year's paydays, goals moved and habits kept. Build it after v1 if time is short.

## Share cards
Receipt, milestone and level up can be shared as an image with **amounts hidden by default** (a toggle shows them). Render the card with Skia `makeImageSnapshot` and share with `expo-sharing`. There's no network, so the share sheet is the only way out.

## Hard no (do not build, even if asked later without a review)
- Timers, countdowns, "only today", or any urgency.
- Prizes, spins, scratch cards, lotteries, cashback.
- Leaderboards, "X people invested today", or any social proof or comparison with others.
- Guilt or shame copy, sad Gullu for missing a payday, or streak-loss alarms.
- Celebrating market gains or net-worth jumps caused by markets.
- Rewards for app opens, daily check-ins or time spent in the app.
- Notifications beyond the 8 kinds in `07-NOTIFICATIONS-WIDGETS.md`, or more than 2 a week.

Why: India's 2023 guidelines on dark patterns (CCPA) and SEBI's direction on investment-app nudges treat false urgency, nagging and gamified trading as harmful. More importantly, a planner that tricks people loses their trust in its numbers.
