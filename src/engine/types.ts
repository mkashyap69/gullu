// Domain types for the v1 plan engine. Pure data: no React, no I/O.

export type AssetClass = 'cash' | 'debt' | 'indianEquity' | 'globalEquity' | 'gold' | 'other';
/** Classes that receive new money. "other" is tracked in net worth but never gets new money by default. */
export const PLANNED_CLASSES = ['cash', 'debt', 'indianEquity', 'globalEquity', 'gold'] as const;
export type PlannedClass = (typeof PLANNED_CLASSES)[number];
export const ALL_CLASSES: readonly AssetClass[] = [...PLANNED_CLASSES, 'other'];

export type RiskProfile = 'safetyFirst' | 'cautious' | 'balanced' | 'growth' | 'aggressive';
export const RISK_ORDER: readonly RiskProfile[] = ['safetyFirst', 'cautious', 'balanced', 'growth', 'aggressive'];
export type Work = 'salaried' | 'business' | 'freelance' | 'retired';
export type Stage = 'starter' | 'builder' | 'peak' | 'preRetiree' | 'retiree';
export type Priority = 'must' | 'should' | 'nice';
export type Affordability = 'comfortable' | 'manageable' | 'stretch';
export type ChanceWord = 'almostSure' | 'likely' | 'possible';

/** A calendar month as `year * 12 + monthIndex` (monthIndex 0 = Jan). */
export type YM = number;

export type Assumptions = {
  /** Expected yearly return % per class (median path). */
  returnPct: Record<AssetClass, number>;
  /** Yearly volatility % per class (Monte Carlo). */
  volatilityPct: Record<AssetClass, number>;
  /** General inflation %. Goals carry their own. */
  inflationPct: number;
  /** Yearly raise applied to every goal's monthly amount (% per year). */
  stepUpPct: number;
  /** Real return % assumed after retirement, used to size the retirement corpus. */
  retirementRealReturnPct: number;
  showTodayRupees: boolean;
  preset: 'default' | 'cautious' | 'hopeful' | 'custom';
};

export type Profile = {
  name: string;
  age: number;
  /** Month the age was recorded; age advances from here. */
  ageAt: YM;
  work: Work;
  dependents: number;
  /** Day of month money lands (1–31), 0 for the last day, -1 when it varies. */
  paydayDay: number;
  stage: Stage;
  riskCapacity: RiskProfile;
  riskTolerance: RiskProfile;
  /** User's own choice after the check; null means the lower of capacity/tolerance. */
  riskOverride: RiskProfile | null;
  riskCheckedAt: YM | null;
  monthlyExpenses: number;
  /** Take-home income per month (capacity check: EMIs as a share of income). */
  monthlyIncome?: number;
  /** Paid unevenly: payday follows money in, not a date. */
  incomeVaries?: boolean;
  /** Total monthly amount the user puts in on payday. */
  monthly: number;
};

export type RetirementSpec = {
  /** Spending per month in today's rupees. */
  targetMonthly: number;
  retireAge: number;
  /** Plan for money to last until this age. */
  untilAge: number;
  /** Pension or other income per month in today's rupees (reduces the corpus needed). */
  pensionMonthly?: number;
};

export type Goal = {
  id: string;
  name: string;
  template: 'safetyNet' | 'retirement' | 'home' | 'education' | 'travel' | 'health' | 'custom';
  /** Target in today's rupees. For retirement it is derived from `retirement`. */
  targetToday: number;
  inflationPct: number;
  date: YM;
  priority: Priority;
  /** The user's own monthly amount for this goal (the "actual"). */
  monthly: number;
  isSafetyNet: boolean;
  isRetirement: boolean;
  retirement?: RetirementSpec;
  /** Months of expenses for the safety net. */
  safetyMonths?: number;
  status: 'active' | 'reached' | 'paused';
  createdAt: YM;
};

export type Holding = {
  id: string;
  name: string;
  type: 'mutualFund' | 'indexFund' | 'stock' | 'etf' | 'ppf' | 'epf' | 'nps' | 'fd' | 'bond' | 'sgb' | 'cash' | 'property' | 'crypto' | 'other';
  assetClass: AssetClass;
  /** A single stock (counts for the concentration nudge). Index and diversified funds are false. */
  isStock: boolean;
  /** Gets new money in the plan. */
  planned: boolean;
  value: number;
  /** Money that goes in automatically outside payday (EPF from salary), per month. Rises with the yearly raise. */
  autoMonthly?: number;
  valueAt: YM;
  createdAt: YM;
};

export type HoldingGoal = { holdingId: string; goalId: string; pct: number };

export type Loan = { id: string; name: string; ratePct: number; emi: number; balance: number; endDate: YM };

export type FlowRule =
  | { id: string; order: number; enabled: boolean; type: 'safetyNet' }
  | { id: string; order: number; enabled: boolean; type: 'costlyDebt'; thresholdPct: number }
  | {
      id: string;
      order: number;
      enabled: boolean;
      type: 'commitment';
      instrument: 'PPF' | 'NPS' | 'ELSS' | 'SSY';
      holdingId: string;
      yearlyCap: number;
      /** Already paid this financial year (April–March). */
      paidThisYear: number;
    }
  | { id: string; order: number; enabled: boolean; type: 'goals' };

export type PlanInput = {
  today: YM;
  profile: Profile;
  assumptions: Assumptions;
  goals: Goal[];
  holdings: Holding[];
  holdingGoals: HoldingGoal[];
  flowRules: FlowRule[];
  loans: Loan[];
};

export type ChanceBands = { almostSure: number; likely: number; possible: number };

export type GoalResult = {
  goalId: string;
  name: string;
  priority: Priority;
  /** Months from today to the goal date. */
  months: number;
  targetToday: number;
  targetNominal: number;
  /** Current value of holdings assigned to this goal. */
  current: number;
  actualMonthly: number;
  /** Monthly needed on the goal step for the likely path to reach the target, rounded up to ₹500. */
  requiredMonthly: number | null;
  /** The same, unrounded. */
  requiredExact: number | null;
  /** Expected (likely) value at the goal date, in today's rupees. */
  likelyToday: number;
  /** Chance bands at the goal date in today's rupees (filled by Monte Carlo; single-line fills likely only). */
  bands: ChanceBands | null;
  /** Month the likely path reaches the target (may be before or after the goal date), or null. */
  projectedDate: YM | null;
  /** Range of months the target is reached: [possible (early), almost sure (late)]. */
  dateRange: [YM, YM] | null;
  affordability: Affordability;
  onTrack: boolean;
  /** Likely shortfall at the goal date in today's rupees (0 when on track). */
  shortBy: number;
  mixNow: Record<PlannedClass, number>;
  /** Retirement only: earliest age the likely path covers the corpus. */
  couldStopAt?: number;
};

export type MoveLine = { holdingId: string; goalId: string; assetClass: PlannedClass; amount: number };
