# Kickoff prompt for Claude Code

Unzip this folder, `cd` into it, start Claude Code there, and paste the prompt below. It builds the app inside this folder, so the docs and designs stay next to the code.

---

You're building **Money Plan**, a goal-first investing planner for India, as a React Native app with Expo. The product, all 45 screens, the design system, the mascot Gullu, and a working reference engine are in this folder.

1. Read `CLAUDE.md`, then `docs/01-PRODUCT.md` and `docs/08-BUILD-PLAN.md`. Skim `docs/02-SCREENS.md` and look at a few PNGs in `design/screens/` (start with `V-2-1-Home.png`, `V-4-2-Payday.png`, `V-10-3-Collection.png`) to get the look.
2. Read `docs/04-MOTION.md` carefully. Beautiful, physical animation and motion design across the whole app is a core requirement, not polish.
3. Run `node --test reference/engine.test.js` to confirm the reference engine passes.
4. Write your plan for Phase 0 and Phase 1 in `docs/progress.md`, then build them: scaffold the Expo app in this folder (keep `docs/`, `design/`, `reference/`, `seed/`, `assets/` where they are), add the theme and motion tokens and primitives, port the engine to TypeScript with Fixture A passing in Jest, and set up the encrypted data layer with the Manish/Sunita demo data.
5. Then do Phase 2: Gullu in Skia with his full animation library, and the six signature moments in a dev "Motion lab" screen. **Stop after Phase 2** and tell me how to run the Motion lab so I can review the motion before you build the screens.

Ask me if anything in the docs contradicts itself. Don't guess on product rules.
