# 04 · Motion and animation

Motion is a core part of this app, not polish added at the end. Every screen has motion, and a few moments get a lot of it. The per-screen choreography is in `02-SCREENS.md` (the **Motion** line on each screen). This doc is the system those lines are built from.

## Principles

1. **Physical, not decorative.** Things have weight. Coins fall and land, bubbles float, Gullu squashes when something hits him. Use springs for anything the user touches or that "arrives", and timing curves only for fades and draws.
2. **Motion explains money.** Every animation answers a question: where did my money go (bubbles leaving Gullu), how sure is this (bands settling around a line), what changed (old value strikes through, new one slides in). If an animation doesn't explain something or confirm an action, cut it.
3. **Celebrate habits, stay calm about markets.** Big celebrations are only for things the user did: payday placed, streaks, levels, goals reached. Market falls get the calmest motion in the app: slow draws, no shake, no red flashes. Never animate a gain as a win.
4. **Fast to interactive.** Entrance choreography never blocks input. The primary button is tappable from frame one, even while it's still sliding in. Total entrance time is ≤ 600ms on normal screens and ≤ 1.2s on signature moments.
5. **One hero per screen.** Each screen has one thing that moves most (the ring, the coin, the band). Everything else enters quietly around it.
6. **Never casino.** No spinning reels, slot-machine counters, flashing lights, countdown timers or "spin to win". Number count-ups ease out and land; they don't flicker through random digits.

## Stack

| Need | Library |
| --- | --- |
| All animation logic | `react-native-reanimated` 4.x (+ `react-native-worklets`), running on the UI thread |
| Shared element transitions | Reanimated `sharedTransitionTag` (on by default from 4.8; on 4.2–4.7 enable the `ENABLE_SHARED_ELEMENT_TRANSITIONS` flag). Check which version your Expo SDK installs. |
| Simple state transitions | Reanimated 4 CSS transitions/animations (`transitionProperty`, `animationName`) for fades, colour and size changes |
| Layout changes | Reanimated layout animations (`entering`, `exiting`, `layout={LinearTransition.springify()}`) |
| Gullu, rings, dials, charts, gradients, particles | `@shopify/react-native-skia`, driven by Reanimated shared values |
| Gestures | `react-native-gesture-handler` (pan for dials, scrub and sliders; long-press for reorder) |
| Haptics | `expo-haptics` |
| Bottom sheets | `@gorhom/bottom-sheet` (or the Expo UI drop-in) |

**Do not use** Lottie for Gullu: he must be parametric (skins × expressions × poses). Lottie is acceptable only for one-off decorative loops if needed later.

## Motion tokens

Put these in `src/theme/motion.ts` and use only these. No magic numbers in components.

```ts
import { Easing } from 'react-native-reanimated';

export const duration = {
  instant: 90,    // press feedback
  fast: 160,      // toggles, small fades
  base: 240,      // most enters/exits
  slow: 400,      // screen-level reveals
  draw: 900,      // chart/ring/line draws
  calm: 1200,     // market-fall line draw (deliberately slow)
  celebrate: 1600 // particles, level up
} as const;

export const easing = {
  out: Easing.bezier(0.22, 1, 0.36, 1),      // enters, draws (easeOutQuint-ish)
  inOut: Easing.bezier(0.65, 0, 0.35, 1),    // cross-fades, morphs
  in: Easing.bezier(0.55, 0, 1, 0.45),       // exits only
} as const;

export const spring = {
  press:  { damping: 18, stiffness: 420, mass: 0.6 },  // buttons, chips
  snappy: { damping: 16, stiffness: 260, mass: 0.8 },  // pills, toggles, list reorder
  bouncy: { damping: 9,  stiffness: 180, mass: 0.9 },  // Gullu landing, bubbles arriving
  gentle: { damping: 20, stiffness: 120, mass: 1 },    // sheets, rings filling, layout
  float:  { damping: 6,  stiffness: 40,  mass: 1 },    // idle bob (use with withRepeat)
} as const;

export const stagger = { list: 40, cards: 60, rings: 80 } as const;
export const distance = { enter: 12, sheet: 24 } as const; // px to translate on enter
```

## Standard patterns

**Screen enter.** The hero element animates first. Text rises `distance.enter` px and fades in (`duration.base`, `easing.out`) staggered by `stagger.cards`. The primary button enters last but is interactive immediately.

**Screen transitions.** Native stack (`react-native-screens`) push and pop, with three app-specific additions:

- **Gradient cross-fade:** when moving between screens with different background variants, the `ScreenBackground` cross-fades colours over `duration.slow` instead of hard-cutting. Keep the background in a persistent layer behind the navigator so it can morph.
- **Shared elements** for the key zooms: Home ring → Goal detail chart; Payday bubble → Why this amount header; Collection tile → Gullu in the header; Gullu on Home → Gullu on Payday (he "walks" over).
- **Sheets** (Apply, Pick a challenge, Too aggressive, Short month) rise with `spring.gentle` over a scrim that fades to 60%.

**Lists.** Items enter with `FadeInDown.springify()` staggered by `stagger.list`, capped at 8 items (the rest appear together). Reorder uses lift (scale 1.03 + shadow), `spring.snappy`, and a selection haptic on each slot change.

**Press feedback.** Everything tappable scales to 0.97 on press-in (`spring.press`) and back on release. Primary buttons also give a light impact haptic on press-in, not on release.

**Numbers.** `<Amount>` animates value changes:
- **Count-up** on first reveal (hero amounts, net worth, the 0 → 3 in "3 of 4"): `duration.slow` to `duration.draw`, `easing.out`, and land on the exact final value.
- **Odometer roll** for live edits (dials, sliders, presets): each digit column rolls independently. Use tabular figures so widths never jump.
- **Before → after** in What if and Apply: the old value gets a strike line drawn through it (`duration.fast`), then the new value slides in from the right.
- **Hide amounts:** digits blur and fade to `₹ ••••••` over `duration.fast`, and reverse when shown.

**Charts** (all Skia):
- Lines and rings draw with path trim (`start` 0 → 1) over `duration.draw`.
- Range bands appear *after* the expected line: they expand vertically from the line over `duration.slow`, so the user sees "here's the likely path, and here's how wide it could be".
- Scrub lenses follow the finger with no smoothing lag, snap to months, and give a selection haptic at each year boundary.
- Updating data morphs paths (interpolate point arrays) rather than redrawing from zero.

## Gullu's animation library

Build these as functions on the `<Gullu>` component (imperative ref or prop-driven), all on the UI thread:

| Animation | Description | Where |
| --- | --- | --- |
| `idleBreathe` | Body scale 1 → 1.02 → 1, 3s loop, `easing.inOut`. Aura opacity follows. | Everywhere Gullu idles |
| `blink` | Eyes scaleY 1 → 0.1 → 1 in 140ms, every 3.5–6s at random. Double blink 20% of the time. | Everywhere |
| `lookAt(x, y)` | Pupils offset up to 4px toward a point, `spring.snappy`. | Home (tracks the payday bar), Payday (watches the coin) |
| `land` | Drop from −80px; squash (scaleY 0.86, scaleX 1.1) on impact, then stretch and settle with `spring.bouncy`. Lid lags 40ms. | Welcome, Level up |
| `catchCoin` | Coin falls along an arc into the slot; on contact the body squashes, cheeks flush, heavy haptic. | Payday |
| `hop` | Small jump (−18px) with squash/stretch and a light haptic. | Check-in done, money minute correct |
| `wave` | Right arm oscillates between the `down` and `up` poses twice. | Welcome, greetings |
| `celebrate` | Arms to `up`, coins burst from behind (particles), beads ripple. | Milestone, goal day, receipt |
| `spin` | 360° Y-rotation faked in 2D: scaleX 1 → 0 → −1 → 0 → 1 with the face hidden at the edges, 900ms. | Level up |
| `setExpression(e)` | Cross-fade face parts over `duration.fast`; arms morph to the new pose with `spring.snappy`. | Anywhere the mood changes |
| `setSkin(s)` | New extras draw on (stroke trim) and the body gradient cross-fades over `duration.slow`. | Collection, Level up |
| `stretchPull(progress)` | On pull-to-refresh, body stretches up to 1.15× tall as you pull, then snaps back with `spring.bouncy`. | Home |
| `sleepy` | Slow breathe (5s) with the z's floating up and fading. | Quiet hours, empty states |
| `concern` | Sweat drop slides down once. No shaking. | Too-aggressive sheet, short month |

Gullu must never look anxious during a market fall. Use `think` or `happy` there, never `concern`.

## Signature moments

These six get extra craft. Prototype them first (see `08-BUILD-PLAN.md`, phase 2).

1. **Payday catch (4.2).** The money lands: a gold coin with ₹ falls from the top, Gullu tracks it and catches it in his slot (`catchCoin`), the ₹55,000 counts up, then five bubbles pop out of Gullu one by one (80ms apart) and float on springs to their positions. Each bubble's size is based on √amount and each has its own idle bob phase. Haptics: heavy on catch, then a light tick per bubble.
2. **The answer (1.7).** The onboarding payoff. The dial ticks light up in a hue sweep around Gullu (60 ticks, 15ms apart), "3 of 4" counts, Gullu celebrates, and goal rows cascade in with their status colour sweeping across each row. The off-track goal pulses amber once.
3. **Rings to detail (2.1 → 3.2).** Tap a goal ring: it scales up and morphs (shared element) into the Goal detail chart's frame, and the range band draws itself in.
4. **Check-in to receipt (4.4 → 4.5).** Each tick draws a check and advances a progress ring. On the last tick Gullu hops, the screen cross-fades to `ember`, and the receipt slides out of a slot line by line with a ratchet haptic per line. The streak row fills cell by cell.
5. **Level up (10.2).** The background dims, Gullu lands, spins once, and the gold rim draws on with a shine sweep across the body. Coin and marigold particles fall. Success haptic. This is the single biggest celebration in the app and must stay rare (it fires at most once per level).
6. **Market fall (2.2).** The anti-celebration. A slow 1.2s line draw, then the expected range band fades in behind it, so the user *sees* the fall sitting inside the range. Gullu stays calm and the "Keep going" button breathes softly. No haptics.

## Particles

Build one Skia `<Particles>` system and reuse it:

- Types: `coin` (gold disc with ₹), `petal` (marigold orange/yellow ellipse), `dot` (Holi colours, Holi skin only).
- Physics: initial velocity cone upward, gravity, slight drag, random spin, fade out in the last 30% of life.
- Budget: ≤ 60 particles, ≤ `duration.celebrate`, computed in a worklet (`useFrameCallback`), drawn as a Skia `Atlas` or picture.
- Used in Milestone, Goal day, Level up, Receipt (small burst), and the 1.7 Answer (small burst).

## Ambient motion

Subtle and slow, so screens feel alive without being busy:
- Background gradient drifts (the stops shift a few percent over 8–12s, looping) on `dusk` and `ember` only.
- Gullu `idleBreathe` + `blink`.
- Payday bubbles bob.
- **Pause ambient loops** when the screen isn't focused, the app is backgrounded, or Low Power Mode is on.

## Haptics map

| Event | Haptic |
| --- | --- |
| Primary button press-in | `impactAsync(Light)` |
| Pill/segment change, list reorder slot, dial tick (each ₹1,000), scrub year boundary | `selectionAsync()` |
| Coin caught (Payday), Gullu lands | `impactAsync(Heavy)` |
| Check-in tick | `impactAsync(Medium)` |
| Receipt line | `impactAsync(Rigid)` at low intensity, or `selectionAsync()` |
| Level up, milestone, goal reached | `notificationAsync(Success)` |
| Destructive confirm (delete everything) | `notificationAsync(Warning)` |
| Market fall screen | **none** |

Route every call through a `haptics.ts` wrapper with a global "Haptics" setting (on by default).

## Reduced motion (hard requirement)

Read `AccessibilityInfo.isReduceMotionEnabled()` (and Reanimated's `useReducedMotion()`) and switch to a reduced set:
- Replace translate/scale/spin/particles with opacity cross-fades of `duration.fast`.
- Charts appear fully drawn; numbers show their final value immediately.
- Gullu keeps blinking (tiny, non-vestibular) but doesn't breathe, hop, land or spin.
- No ambient gradient drift and no parallax.
- Haptics stay (they aren't motion).

Add a "Reduce animations" switch in You → Settings that forces this mode regardless of the OS setting.

## Performance budget

- 60fps on a mid-range Android phone (target a Pixel 6a or a Redmi Note-class device); 120fps on ProMotion iPhones where possible.
- All continuous animation runs on the UI thread (Reanimated worklets + Skia). **No `setState` per frame.**
- Gullu renders as one Skia `Canvas` per instance. If more than 3 Gullus are on screen (Collection grid), render static snapshots (`makeImageSnapshot`) for the tiles and animate only the selected one.
- Engine recompute on slider drag ≤ 16ms (single-line path). Monte Carlo ranges run off the JS thread (a worklet runtime or a chunked task) and land within ~300ms, then animate in. Never jank a gesture waiting for the engine.
- Profile with the Reanimated/Skia FPS monitors and Android "Profile GPU rendering". Add a dev overlay that shows FPS.

## QA checklist for every screen

- [ ] Matches the **Motion** line in `02-SCREENS.md`.
- [ ] Uses only `motion.ts` tokens.
- [ ] Primary action is tappable during the entrance animation.
- [ ] Reduced-motion variant works.
- [ ] No dropped frames in a release build on the low-end Android target.
- [ ] Haptics match the map; none on the market-fall screen.
- [ ] Ambient loops pause off-screen.
