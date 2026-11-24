# 01 · Product

Money Plan is a goal-first investing planner for India. You tell it who you are, what you're saving for and how much you can put in each month. It tells you whether your goals will happen, when, and exactly where this month's money should go. It is **fully offline in v1**: no account, no server and no network calls.

Mascot: **Gullu**, a clay gullak (Indian piggy bank). He is your planning buddy and shows up on every key screen.

## Who it's for

Every age and every risk profile, not one kind of investor. Two personas drive the designs (`seed/fixtures/personas.ts`):

- **Manish, 32**: salaried, 2 dependents, Balanced profile, invests ₹55,000/month across Home, PPF, Education, Retirement and a Japan trip. Net worth ₹84.3 L, car loan ₹3.1 L. Education is short by ₹6 L.
- **Sunita, 64**: retired, living off ₹2.4 Cr plus a pension. ₹90,000/month, likely until 98 and almost sure until 91. Three buckets.

## The planning model

The app plans in six steps. Only the last one touches specific funds.

1. **Profile:** age, work type, dependents, payday, and a risk profile.
2. **Goals:** each has a target in today's rupees, a date, a priority (must / should / nice) and its own inflation.
3. **Monthly flow rules:** the ordered steps every payday follows (safety net, costly debt, commitments, goals).
4. **Mix per goal:** asset-class split from the profile, capped by the goal's horizon, gliding safer as the date nears.
5. **Holdings:** the user's own funds, stocks, FDs and so on, each tagged with an asset class. One holding can serve several goals by %.
6. **Moves:** this month's rupees per holding, which the user carries out in their own apps.

**Asset classes, not instruments.** There are six: cash, debt (FDs, debt funds, PPF, EPF, bonds), Indian equity, global equity, gold, and other (property, crypto, startups). "Other" is tracked in net worth but never gets new money by default.

**The safety net is goal 0.** It is always cash or liquid debt: 6 months of expenses for salaried users, 9–12 for business owners and freelancers.

**Retirement is a default goal for everyone.**

## Risk profiles

A 5-question check scores two things separately and **the lower one wins**:

- **Capacity:** age, income stability, dependents, EMIs as a share of income, and whether the safety net is full.
- **Tolerance:** two scenario questions ("Your ₹10 L falls to ₹7.5 L in a bad year. What do you do?") plus investing experience.

| Profile | Usually fits | Equity | Debt | Gold | Cash |
| --- | --- | --- | --- | --- | --- |
| Safety-first | New investors, retirees living off savings | 20% | 65% | 10% | 5% |
| Cautious | Uneven income, many dependents, near a big goal | 40% | 45% | 10% | 5% |
| Balanced | Most salaried people with 10+ year goals | 60% | 28% | 10% | 2% |
| Growth | Steady income, under 40, has lived through a fall | 75% | 15% | 8% | 2% |
| Aggressive | High capacity and tolerance, long horizon | 85% | 7% | 8% | 0% |

These are illustrative defaults. Inside equity, higher profiles allow more mid and small caps (up to 30% of equity) and more global funds (up to 25%).

**Horizon caps** keep short-term money safe whatever the profile:

| Years to goal | Max equity |
| --- | --- |
| Under 3 | 20% |
| 3 to 5 | 40% |
| 5 to 7 | 60% |
| 7+ | The profile's own mix |

**Glide path.** As a goal crosses into a shorter band, new money goes to debt first, so the mix drifts down to the cap **without forced selling**.

**Moving levels.** Users can move down a level freely. Moving up shows the "too aggressive" warning (screen 8.5). The check is retaken yearly and after life events.

## Life stages

Age picks defaults (pre-added goals, what Home stresses, Gullu's tone). It never locks anything.

| Stage | Age | Goals added | Stresses | Gullu's tone |
| --- | --- | --- | --- | --- |
| Starter | 18–27 | Safety net, retirement, one short goal | Clear costly debt, start small, raise SIP yearly | Encouraging, explains every term |
| Builder | 28–40 | Safety net, home, child's education, retirement | Juggling goals, prepay or invest, insurance check | Practical, trade-offs in rupees |
| Peak | 41–55 | Education (near), retirement catch-up, parents' care | Glide paths, catch-up, de-risking | Steady, no drama |
| Pre-retiree | 56–60 | Retirement income, health corpus | "Can I retire at 58?", building buckets | Careful, shows the range |
| Retiree | 60+ | Monthly income, health, legacy | Withdrawal mode, three buckets | Reassuring, calm in falls |

**Withdrawal mode** (pre-retiree and retiree): three buckets. Cash covers the next 2 years of spending, income (low risk) covers years 3–7, and growth covers the rest. Each April the income bucket refills cash. In a down year, growth isn't sold to refill income. The Payday tab becomes **Income** for retirees.

## Information architecture

Five tabs: **Home · Goals · Payday (Income for retirees) · Wealth · You**. What if is a sandbox reached from Home, any goal and Wealth, not a tab. Levels and streak are reached from Home's header chip and from You.

## The 10 research-driven changes (all in the designs)

1. **Comfortable / Manageable / Stretch** word on every goal (Wealthfront). On Home rings and the Goals list.
2. **Required vs actual** on every goal row: "₹12,500 a month, needs ₹16,000" (INDmoney).
3. **One holding split across goals** by % (NaviPlan). Screen 5.6.
4. **Concentration nudge**: a single stock above **10%** of investing is flagged on Mix check. Index funds are excluded.
5. **"Every rupee gets a job"**: the payday framing (YNAB).
6. **Milestone dates as a range**: "Sep 2031 (Jun–Dec)" (ProjectionLab).
7. **"Replay 2008"** scenario chip in What if.
8. **"Too aggressive for your goals"** warning on upward override (Betterment). Screen 8.5.
9. **Chance words, not percentages**: "Almost sure ₹28 L · Likely ₹34 L · Possible ₹43 L" (= 10th / 50th / 90th percentile).
10. **Avoid list** in Gullu's voice: never timers, prizes, guilt or comparisons with other people.

## Fully offline v1

- **No network calls, ever.** No analytics SDKs, no crash reporters that phone home, no remote config, no font CDNs. Bundle everything.
- **Values come from the user.** Each payday check-in ends with a 20-second value update: one current value per asset class, pre-filled with the projected value so most people just confirm. Holdings older than 60 days get a "stale" nudge.
- **Market-fall moment (2.2):** the app tracks the fall from the highest *recorded* total and fires once per fall when it crosses 10% (smaller for Safety-first and Cautious). Copy says only what the app knows: "Your investments are ₹12.2 L below their high, as of your 1 Apr values." It never makes a claim about the market.
- **Data:** encrypted on device, app lock (Face ID / PIN), hide amounts, export JSON/CSV, delete everything.
- v2 (not now): Account Aggregator import, family view.

## Compliance guardrails (product view, not legal advice)

- v1 is a **planning calculator**. Mixes are at asset-class level, labelled illustrative, and chosen and editable by the user.
- **The app never names a fund, stock or scheme it hasn't been given by the user, and never says "buy" or "sell".** It shows "moves" into the user's own holdings.
- Disclaimer on onboarding, every projection screen and every shared card: *"Projections use the return assumptions you set. They are not guarantees or investment advice."*
- Any paid personalised-advice tier needs a SEBI-registered adviser route first. Not in v1.
- Shared cards (receipt, milestone, level up) hide amounts by default.

## Out of scope for v1

Account linking, family accounts, any server, any purchase or trade execution, paid tiers, social features, leaderboards.
