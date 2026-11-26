# Performance notes (Phase 11)

Measured in plain Node (V8). Jest runs these 5–20× slower (Math.exp under its transform), so use Node numbers for budgets. Hermes on a low-end Android is typically 3–5× slower than V8: **check on device**.

| Work | Where it runs | V8 | Budget |
| --- | --- | --- | --- |
| Single-line plan (`computePlanFast`, 4 goals) | JS, live on sliders | a few ms | ≤ 16 ms |
| Goal Monte Carlo, 1,000 paths | off-thread worklet runtime (`runMonteCarlo`) | ~1 s per plan | ranges settle ~300 ms after a drag ends |
| What if compare (all goals, before + after) | JS, per slider step | ~10 ms | ≤ 16 ms |
| Timeline, 60 months by class | JS, once per screen | < 1 ms | — |
| Retiree income Monte Carlo, 1,000 paths × 46 years | JS, a beat after first paint | ~117 ms | screen never waits on it |

- Continuous animation runs on the UI thread (Reanimated/Skia); no setState per frame. Discrete updates (timeline months, counts) set state per step, not per frame.
- Ambient loops stop when the screen is unfocused, the app is in the background, reduced motion is on, or low-power mode is on (`useAmbient`).
- Particle budget: 60 (`signature.particleBudget`).
- **To do on device:** if the retiree Monte Carlo shows as a hitch on Hermes, move `withdrawalRanges` to the worklet runtime like the goal Monte Carlo.
