/**
 * 10.6 Money minute: 24 bundled cards, one a week. Card 5 is from the design; the rest are drafted
 * (see docs/progress.md). A card can use the user's own goal (name and year) in its question.
 */
export type MinuteCard = {
  q: string | ((g: { name: string; year: number }) => string);
  options: [string, string, string];
  answer: 0 | 1 | 2;
  why: string;
  /** The related Learn card (8.4). */
  learn: string;
};

export const MINUTE_CARDS: MinuteCard[] = [
  { q: 'What does a SIP do?', options: ['Puts in a fixed amount every month', 'Picks the best fund each month', 'Waits for markets to fall first'], answer: 0, why: 'A SIP is just a habit on autopilot: the same amount, every month, whatever the market is doing.', learn: 'SIP' },
  { q: 'Your safety net is for…', options: ['A sudden bill or a gap in income', 'A holiday next year', 'Investing when markets fall'], answer: 0, why: 'It covers surprises, so you never have to pull money out of long-term goals at a bad time.', learn: 'Safety net' },
  { q: "What does 'in today's rupees' mean?", options: ['The amount with prices as they are now', 'The amount after tax', 'The amount the bank pays today'], answer: 0, why: 'Future amounts are shown as what they would buy today, so ₹30 L means the same thing in 2031 as it does now.', learn: "Today's rupees" },
  { q: 'Markets fall 20% this year. What does the plan do?', options: ['Stops your monthly amounts', 'Keeps going, and new money gets more units', 'Moves everything to cash'], answer: 1, why: 'Falls are part of the deal. Carrying on means new money gets more units while prices are low.', learn: 'Drawdown' },
  {
    q: (g) => `What happens to your ${g.name} money as ${g.year} gets closer?`,
    options: ['It moves into more equity to grow faster', 'It shifts towards safer debt and cash', 'Nothing changes until the date'],
    answer: 1,
    why: "Right. It's called a glide path: as a goal gets close, a market fall would hurt more, so new money goes to safer places first.",
    learn: 'Glide path',
  },
  { q: 'Inflation at 6% a year roughly doubles prices in…', options: ['6 years', '12 years', '30 years'], answer: 1, why: 'At 6% a year, prices double in about 12 years. That is why goals are planned in today’s rupees.', learn: 'Inflation' },
  { q: 'Why does the plan raise your monthly amount each year?', options: ['To keep up as you earn more', 'Because returns fall each year', 'It’s a fee'], answer: 0, why: 'A small yearly step-up does a lot of the work. It matches what you put in to what you earn.', learn: 'Step-up' },
  { q: 'Compounding means…', options: ['Returns earn their own returns', 'Paying interest on interest', 'Adding a new goal each year'], answer: 0, why: 'Growth on growth. It’s slow at first and strong later, which is why starting early matters.', learn: 'Compounding' },
  { q: 'Which usually swings the most in a year?', options: ['Cash', 'Debt', 'Equity'], answer: 2, why: 'Equity grows most over long stretches and swings most along the way. Short goals hold less of it.', learn: 'Equity' },
  { q: 'An index fund…', options: ['Holds a whole market index at a low cost', 'Has a manager picking stocks daily', 'Guarantees a return'], answer: 0, why: 'It follows the index, so costs stay low and there is no star manager to depend on.', learn: 'Index fund' },
  { q: 'A 1% yearly fee on ₹10 L for 20 years costs roughly…', options: ['₹20,000', '₹2 L', 'Several lakh'], answer: 2, why: 'Fees compound too. Over 20 years a 1% fee can take several lakh off the final amount.', learn: 'Expense ratio' },
  { q: 'How much can go into PPF in a financial year?', options: ['₹50,000', '₹1.5 L', 'No limit'], answer: 1, why: 'PPF takes up to ₹1.5 L a year. The plan spreads it over the months to 31 March.', learn: 'PPF' },
  { q: 'ELSS money is locked in for…', options: ['1 year', '3 years', '15 years'], answer: 1, why: 'Three years, the shortest lock-in among the usual tax-saving options.', learn: 'ELSS' },
  { q: 'Your mix drifts to more equity after a good year. The plan…', options: ['Takes money out of equity', 'Steers new money to the other classes', 'Ignores it'], answer: 1, why: 'New money goes where the mix is short, so it comes back into line without taking anything out.', learn: 'Rebalancing' },
  { q: 'Which loan is usually worth paying off before investing more?', options: ['A home loan at 8.5%', 'A credit card at 36%', 'An education loan at 9%'], answer: 1, why: 'Costly debt beats most returns. The plan clears anything above your costly-debt line first.', learn: 'Compounding' },
  { q: "'Likely' on a goal means…", options: ['The middle of the range of outcomes', 'The best case', 'A promise'], answer: 0, why: 'Half the paths end higher, half lower. “Almost sure” is the weak-markets case.', learn: 'Corpus' },
  { q: 'Spreading money across classes mainly…', options: ['Raises returns every year', 'Stops one fall sinking the plan', 'Avoids tax'], answer: 1, why: 'Different things fall at different times. Spreading out keeps any one fall from doing all the damage.', learn: 'Diversification' },
  { q: 'A liquid fund is good for…', options: ['Money you may need any time', 'Money for 20 years from now', 'Beating equity'], answer: 0, why: 'It is steady and quick to reach, which is what a safety net needs.', learn: 'Liquid fund' },
  { q: 'EPF counts towards…', options: ['Your home goal', 'Your retirement', 'Nothing in the plan'], answer: 1, why: 'EPF is retirement money, so the plan counts it there by default.', learn: 'EPF' },
  { q: 'Most of NPS unlocks at…', options: ['45', '60', 'Any time'], answer: 1, why: 'NPS is built for retirement; most of it stays in until 60.', learn: 'NPS' },
  { q: 'XIRR is useful because…', options: ['It counts when each rupee went in', 'It predicts next year', 'It removes fees'], answer: 0, why: 'With monthly money going in, a simple return misleads. XIRR weighs each rupee by how long it was in.', learn: 'XIRR' },
  { q: 'A goal is short by ₹2 L. The steadiest fix is usually…', options: ['A riskier mix', 'A little more each month, or a later date', 'Waiting for a good year'], answer: 1, why: 'More money or more time. A riskier mix can widen the gap as easily as close it.', learn: 'Glide path' },
  { q: 'For retirees, the cash bucket holds…', options: ['The next 2 years of spending', 'Everything', 'Only gold'], answer: 0, why: 'Spending comes from cash, so a fall in markets never forces money out of growth at a low.', learn: 'Corpus' },
  { q: 'Gains when an investment is taken out are…', options: ['Never taxed', 'Taxed, with rules that change', 'Taxed only for retirees'], answer: 1, why: 'Capital gains are taxed and the rules change, so check the current ones before taking money out.', learn: 'Capital gains' },
];

export function cardQuestion(c: MinuteCard, goal: { name: string; year: number } | null): string {
  if (typeof c.q === 'string') return c.q;
  return c.q(goal ?? { name: 'goal', year: new Date().getFullYear() + 5 });
}

export const WEEK_MS = 7 * 86400000;
