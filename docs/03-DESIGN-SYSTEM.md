# 03 · Design system: "Dusk minimal"

The look: deep night-to-sunset gradients, white type, one white pill button, and Gullu. Every screen keeps **one message, one visual, one action**, and detail sits one tap deeper. Tokens are in `seed/theme/tokens.ts`; copy that file into `src/theme/` as-is.

## Rules that make it look like the designs

1. **Full-bleed gradient backgrounds.** There are no flat backgrounds and no white screens. Pick a gradient by screen role (table below). Gradients run top to bottom, always starting at near-black `#07060D` so the status bar sits on dark.
2. **Two text sizes per screen**, chosen from `type` (usually `h1` + `body`, or `big` + `body`). Captions are the only exception.
3. **One primary action:** the white pill (`58px` tall, ink text), pinned near the bottom. Secondary actions are ghost text links below it.
4. **No cards by default.** Content sits on the gradient. Use a `glass` surface (white at 8%, radius 20–28, no border) only for grouped rows, sheets and nudges.
5. **Numbers use tabular figures** (`fontVariant: ['tabular-nums']`) so rolling digits don't jitter.
6. **Indian formatting everywhere:** ₹1,55,84,513 · ₹84.3 L · ₹2.4 Cr. Write one `formatINR(value, { compact })` helper and use only that. In compact form, amounts of ₹1 L or more show as L, and ₹1 Cr or more as Cr, with one decimal unless the value is whole.
7. **Text on gradient** is white (`text`), body text is white at 68%, and captions are white at 60%. Never use grey hex values.
8. **Safe areas:** the design frame is 390×844 with 30px top and 24px side padding *inside* the safe area. Scale horizontally on other widths and don't scale type.

## Gradients by role

| Token | Use for | Screens |
| --- | --- | --- |
| `dusk` | Default: home, goals, onboarding | 1.x, 2.1, 3.x |
| `ember` | Payday and celebrations | 4.2, 4.5, 2.3, 3.5, 10.2 |
| `night` | Calm and data-dense: lists, settings, sheets, notifications | 4.3, 4.4, 5.3, 8.x, 9.x |
| `sky` | Wealth and sandbox | 5.1, 5.2, 6.1 |
| `violet` | Habits and learning | 10.x, 8.4 |
| `dim` | Secondary lists | 4.7 |

`02-SCREENS.md` lists the exact gradient per screen. Implement backgrounds as a single `<ScreenBackground variant="dusk" />` that renders a Skia `LinearGradient`, so it can animate (see motion: ambient drift and gradient cross-fades between screens).

## Components to build (in this order)

| Component | Notes |
| --- | --- |
| `ScreenBackground` | Skia gradient by variant. Animated cross-fade when the variant changes. Slow ambient drift. |
| `Text` variants | `Big`, `H1`, `Body`, `Caption`, `Micro`. Inter only, bundled. |
| `Amount` | Formats INR, rolls digits on change (odometer), respects Hide amounts (renders `₹ ••••••` with a blur transition). |
| `PrimaryButton` | White pill with press scale 0.97 and a light haptic. Has a loading state that morphs into a spinner, then a check. |
| `GhostButton`, `Pill`, `SegmentedPills` | Selected pill background slides between options (shared layout). |
| `Row` | 60px min height, optional dot/icon, chevron, press highlight. |
| `GlassCard`, `Sheet` | Bottom sheet with spring and drag-to-dismiss (`@gorhom/bottom-sheet` or Expo UI's drop-in replacement). |
| `GoalRing` | Skia arc ring with status colour; fills on mount; shared-element source for Goal detail. |
| `Dial` | The 60-tick dial around Gullu (Answer, Home variants). Ticks light up in a hue sweep from 0 to 135°. |
| `Bubble` | Payday bubble sized by √amount, with a floating idle animation. |
| `RangeBand` | Fan chart: almost sure / likely / possible bands plus an expected line, scrub lens. |
| `MixBar` | Actual vs target paired bars per asset class. |
| `StackedTimeline` | Stacked area by class with play and scrub. |
| `ProgressDots`, `Checklist`, `Toggle` | Standard, animated. |
| `Gullu` | See below. |
| `TabBar` | 5 icons (Home, Goals, Payday/Income, Wealth, You) with labels at 11px. Active is white, idle is white at 55%. Active icon does a small bounce on select. |

Icons are simple 24-grid strokes (1.9 stroke, round caps). The set used in the designs is in `design/html/*.dc.html` (search for `<svg width="22"`). `lucide-react-native` is a close match if you'd rather use a library.

## Gullu, the mascot

Gullu is a clay gullak: an orange radial-gradient body, a coin slot on top, a lid knob, two stubby arms and feet, big eyes, pink cheeks, a bead band across the belly, and a soft violet aura behind him.

**Source of truth:** `reference/gullu.js` (a 240×240 viewBox SVG generator) and `assets/gullu/gullu-<skin>-<expression>.svg` (56 exports).

**Build him in Skia, not as static SVG files.** He needs to blink, breathe, squash, track and change pose. Port `gullu.js` part by part into a `<Gullu expression skin size />` Skia component, with each part a separate path so it can animate:

| Part | In `gullu.js` | Animates |
| --- | --- | --- |
| Aura | radial gradient circle r116 | Pulse on celebrate; colour shift by screen |
| Feet | two ellipses at y215 | Squash on landing |
| Arms | stroked paths, `armL` / `armR` by pose | Interpolate between poses (`down`, `up`, `chin`, `side`) by morphing path points |
| Body | the main closed path | Breathing scale; squash and stretch on impact |
| Lid + knob | ellipse + circle at top | Lags behind body on jumps (secondary motion) |
| Coin slot | rect at y74 | Coin disappears into it on Payday |
| Highlight | white ellipse, rotated −32° | Static; shine sweep on level up |
| Band + beads | path + 6 circles | Bead colour by skin; beads ripple on celebrate |
| Skin extras | gold rim, marigold flowers, zigzag, diya flame, Holi splashes | Draw on (stroke) when unlocked; diya flame flickers |
| Face | eyes, pupils, glints, mouth, cheeks by expression | Blinks, pupil tracking, expression cross-fades |

**Expressions:** `happy`, `wave`, `think`, `celebrate`, `sleepy`, `concern`, `catch`.

**Skins:** `base`, `steady` (teal band), `secure` (gold rim), `builder` (+ marigolds), `halfway` (+ gold zigzag), `free` (all-gold glaze), `diwali` (diya flame + marigolds), `holi` (colour splashes). They are unlocked by level or festival and can't be bought (see `06-HABITS.md`).

**Voice rules** (from the mascot sheet, `design/screens/Gullu-Mascot.png`):

- Short, warm and plain. One idea per line, in rupees, never jargon without a Learn card.
- Never says "buy" or "sell", never names a product the user didn't add.
- Calm in falls. Never celebrates market gains, only habits and goals.
- Never uses timers, prizes, guilt or comparisons with other people.
- No exclamation marks except when a goal is reached.

## Accessibility

- Contrast: all text is white or white at 60%+ on gradients that are ≥ `#3A1D7A` dark behind text zones. Check the bottom of `dusk` and `ember` (orange): body text there must stay white at 85% or more, or sit on glass.
- Every Gullu instance has an accessible label ("Gullu, happy").
- Dynamic type: support up to 1.3× before layouts reflow; the `big` style caps at 1.15×.
- Reduced motion: see `04-MOTION.md`. It's a hard requirement.
- All hit targets are ≥ 44pt.
