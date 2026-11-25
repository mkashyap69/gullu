// Asset class names and colours, one place.
import type { AssetClass } from '../engine/types';
import { colors } from '../theme/tokens';

export const CLASS_NAME: Record<AssetClass, string> = { indianEquity: 'Indian equity', globalEquity: 'Global equity', debt: 'Debt', gold: 'Gold', cash: 'Cash', other: 'Other' };
export const CLASS_DOT: Record<AssetClass, string> = { indianEquity: colors.indianEquity, globalEquity: colors.globalEquity, debt: colors.debt, gold: colors.gold, cash: colors.cash, other: colors.other };
