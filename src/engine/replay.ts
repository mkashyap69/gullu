/**
 * "Replay 2008" / "Replay 2020" (05-ENGINE.md step 11): apply historical yearly class returns from
 * that year onward to today's plan. Bundled, approximate calendar-year returns in rupee terms
 * (Indian equity ≈ Nifty 50 TRI, global equity ≈ S&P 500 in INR, gold ≈ INR gold, debt ≈ short-term
 * debt funds, cash ≈ liquid funds). Illustrative: they show the shape of a bad stretch, not a forecast.
 * Order per row: cash, debt, Indian equity, global equity, gold (core.ts class order).
 */
export const REPLAYS = {
  2008: [
    [0.08, 0.09, -0.51, -0.25, 0.3],
    [0.04, 0.05, 0.77, 0.2, 0.2],
    [0.055, 0.055, 0.19, 0.12, 0.23],
    [0.08, 0.08, -0.24, 0.17, 0.31],
    [0.085, 0.09, 0.29, 0.16, 0.12],
  ],
  2020: [
    [0.045, 0.1, 0.16, 0.19, 0.28],
    [0.033, 0.04, 0.26, 0.29, -0.04],
    [0.05, 0.035, 0.05, -0.12, 0.13],
    [0.07, 0.07, 0.21, 0.25, 0.15],
  ],
} as const;

export type ReplayYear = keyof typeof REPLAYS;
export const replayRows = (year: ReplayYear): number[][] => REPLAYS[year].map((r) => [...r]);
