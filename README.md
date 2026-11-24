# Money Plan: build handoff (React Native)

Everything Claude Code needs to build Money Plan end to end as a React Native (Expo) app with rich motion.

## How to use it
1. Unzip and `cd money-plan-handoff`.
2. Optional: `git init && git add -A && git commit -m "Handoff"` so every change Claude Code makes is reviewable.
3. Start Claude Code in this folder and paste the prompt from `KICKOFF.md`.
4. Claude Code reads `CLAUDE.md` automatically on every session, so the rules persist.

## What's inside

| Path | What |
| --- | --- |
| `CLAUDE.md` | Standing instructions: stack, non-negotiables, how to work |
| `KICKOFF.md` | The first prompt to paste |
| `docs/01-PRODUCT.md` | Product model, risk profiles, life stages, the 10 research changes, offline rules, compliance |
| `docs/02-SCREENS.md` | All 45 app screens + 6 notification and widget boards: image, purpose, copy, navigation, motion. Also lists known design fixes |
| `docs/03-DESIGN-SYSTEM.md` | Dusk minimal: gradients, type, components, Gullu's anatomy and voice, accessibility |
| `docs/04-MOTION.md` | Motion system: tokens, patterns, Gullu's animation library, 6 signature moments, haptics, reduced motion, performance |
| `docs/05-ENGINE.md` | Engine spec, Fixture A, how to extend to goals/classes/ranges, offline values, data model |
| `docs/06-HABITS.md` | Streaks, shields, levels, Gullu's looks, challenges, money minute, and the hard-no list |
| `docs/07-NOTIFICATIONS-WIDGETS.md` | 8 local notification kinds with copy and rules; widget sizes and implementation |
| `docs/08-BUILD-PLAN.md` | 12 phases with acceptance criteria and definition of done |
| `design/screens/*.png` | Every screen rendered at 2× (51 boards + the mascot sheet) |
| `design/html/*.dc.html` | Source of each screen with exact inline styles (opens in a browser; ignore the missing `support.js`) |
| `assets/gullu/*.svg` | Gullu in 8 looks × 7 expressions (56 SVGs) |
| `reference/engine.js` + `engine.test.js` | Working reference engine and the Fixture A regression test |
| `reference/gullu.js` | The SVG generator Gullu is drawn from (port to Skia) |
| `seed/theme/tokens.ts` | Drop-in design tokens |
| `seed/fixtures/personas.ts` | Manish (32) and Sunita (64): the demo data behind every screen |

## Decisions made for the React Native version
- **Expo + dev builds** over bare React Native: config plugins cover SQLCipher, widgets and notifications, so there are no hand-edited native folders.
- **Reanimated 4 + Skia** for motion: Gullu, rings, bands and particles run on the UI thread at 60–120fps. Lottie is ruled out because Gullu needs 8 looks × 7 expressions × live poses.
- **Phase 2 is a review gate:** Claude Code builds Gullu and the six signature moments first, then stops so you can judge the motion before it builds 45 screens.
