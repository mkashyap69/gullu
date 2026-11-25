// Display names for profile values (one place).
import type { RiskProfile, Stage, Work } from '@/engine/types';

export const RISK_NAME: Record<RiskProfile, string> = { safetyFirst: 'Safety-first', cautious: 'Cautious', balanced: 'Balanced', growth: 'Growth', aggressive: 'Aggressive' };
export const STAGE_NAME: Record<Stage, string> = { starter: 'Starter', builder: 'Builder', peak: 'Peak', preRetiree: 'Pre-retiree', retiree: 'Retiree' };
export const WORK_NAME: Record<Work, string> = { salaried: 'salaried', business: 'business', freelance: 'freelance', retired: 'retired' };
