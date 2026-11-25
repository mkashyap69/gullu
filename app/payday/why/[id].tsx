/**
 * 4.3 Why this amount (ember). Opens from the tapped bubble (shared element). The flow step, the
 * goal's need, and the split by the goal's mix into the user's own holdings: rows fill as bars in
 * sequence. A shared holding gets a split ring that animates to its shares. "Use a different holding
 * of the same kind" picks which of the user's holdings takes this goal's money.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { GhostButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { GlassCard, Row } from '@/components/Surfaces';
import { Body, Caption, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { equityCap, PROFILE_MIX } from '@/engine/core';
import { labelYM } from '@/engine/dates';
import { linesMoves, movesForPlan, paydayPlan, prefKey } from '@/engine/payday';
import { effectiveRisk, holdingShares, retirementDate } from '@/engine/plan';
import type { PlannedClass } from '@/engine/types';
import { formatINR } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { GoalRing } from '@/motion-kit/GoalRing';
import { usePlanInput } from '@/plan/usePlan';
import { requiredMap } from '@/state/payday';
import { usePaydayStore, useSettingsStore } from '@/state/stores';
import { spring, stagger } from '@/theme/motion';
import { colors } from '@/theme/tokens';
import { lineColor } from '@/screens/payday/lineMeta';

const PRIORITY = { must: 'must', should: 'should', nice: 'nice to have' } as const;
const CLASS_COLOR: Record<string, string> = { cash: colors.cash, debt: colors.debt, indianEquity: colors.indianEquity, globalEquity: colors.globalEquity, gold: colors.gold, loan: colors.short };

function SplitBar({ share, index, color }: { share: number; index: number; color: string }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(reduce ? share : 0);
  useEffect(() => {
    w.value = reduce ? share : withDelay(index * stagger.cards * 2, withSpring(share, spring.gentle));
  }, [share, index, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.bar, { backgroundColor: color }, a]} />
    </View>
  );
}

export default function WhyThisAmount() {
  const { id, amount } = useLocalSearchParams<{ id: string; amount?: string }>();
  const input = usePlanInput();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const prefs = usePaydayStore((s) => s.prefs);
  const setPref = usePaydayStore((s) => s.setPref);
  const [pick, setPick] = useState<PlannedClass | null>(null);
  const total = Number(amount) || input?.profile.monthly || 0;
  const plan = useMemo(() => (input ? paydayPlan(input, total, requiredMap(input)) : null), [input, total]);
  const moves = useMemo(() => (input && plan ? movesForPlan(input, plan, prefs) : []), [input, plan, prefs]);
  if (!input || !plan) return null;
  const line = plan.lines.find((l) => l.id === id);
  if (!line) return null;
  const goal = input.goals.find((g) => g.id === line.goalId);
  const rows = linesMoves(moves, line.id);
  const shares = holdingShares(input);
  const shared = rows.map((r) => input.holdings.find((h) => h.id === r.holdingId)).find((h) => h && (shares.get(h.id)?.size ?? 0) > 1);
  const years = goal ? Math.max(0, ((goal.isRetirement ? retirementDate(goal, input) : goal.date) - input.today) / 12) : 0;
  const cap = Math.round(equityCap(years, PROFILE_MIX[effectiveRisk(input.profile)][0]) * 100);
  const name = (holdingId: string, cls: string) => input.holdings.find((h) => h.id === holdingId)?.name ?? (cls === 'loan' ? line.label : `New ${cls} holding`);
  const L = (v: number) => formatINR(v, { compact: true, hidden });

  let title = '';
  let body = '';
  if (line.kind === 'goal' && goal) {
    const target = goal.isRetirement ? `your retirement` : `${L(goal.targetToday)} in today's rupees`;
    title = line.status === 'next' ? `${goal.name} waits a month.` : `${formatINR(line.amount, { hidden })} keeps ${goal.name} on track.`;
    body =
      goal.priority === 'must'
        ? `It's the amount this goal needs each month to reach ${target}. Must-have goals are funded first.`
        : `It's the amount you set for this goal each month, towards ${target}. Must-have goals are funded first.`;
  } else if (line.kind === 'commitment') {
    title = `${formatINR(line.amount, { hidden })} keeps your ${line.label} on track.`;
    body = `${line.label} takes up to ₹1.5 L a year. It's spread evenly over the months to 31 March, so it always gets there.`;
  } else if (line.kind === 'safety') {
    title = `${formatINR(line.amount, { hidden })} fills your safety net.`;
    body = 'The safety net always comes first. It fills over a year, then money flows on to your goals.';
  } else {
    title = `${formatINR(line.amount, { hidden })} pays down ${line.label}.`;
    body = 'This loan costs more than investing is likely to earn, so part of each payday clears it first.';
  }
  const rowTotal = Math.max(1, rows.reduce((a, r) => a + r.amount, 0));
  const sameKind = pick ? input.holdings.filter((h) => h.planned && h.assetClass === pick && !h.autoMonthly && !input.flowRules.some((r) => r.type === 'commitment' && r.holdingId === h.id)) : [];

  return (
    <Screen background="ember" scroll>
      <LabTop icon="back" />
      <Animated.View sharedTransitionTag={`bubble-${line.id}`} style={[styles.dotBig, { backgroundColor: lineColor(line, input) }]} />
      <Rise index={0}>
        <Caption>{goal ? `${goal.name} · ${goal.isRetirement ? `At ${goal.retirement?.retireAge}` : labelYM(goal.date)} · ${PRIORITY[goal.priority]}` : line.label}</Caption>
        <H1>{title}</H1>
        <Body>{body}</Body>
      </Rise>
      {rows.length ? (
        <Rise index={1}>
          <Caption style={styles.label}>{goal && line.kind === 'goal' ? `Split by this goal's mix (${cap}% equity cap)` : 'Where it goes'}</Caption>
          {rows.map((r, i) => (
            <View key={r.key} style={styles.row}>
              <View style={styles.rowTop}>
                <Body color={colors.text} style={styles.flex}>
                  {name(r.holdingId, r.assetClass)}
                </Body>
                <Amount value={r.amount} variant="label" weight="800" />
              </View>
              <SplitBar share={r.amount / rowTotal} index={i} color={CLASS_COLOR[r.assetClass] ?? colors.white} />
            </View>
          ))}
          {line.kind === 'goal' ? <GhostButton label="Use a different holding of the same kind" onPress={() => setPick((rows.find((r) => r.assetClass !== 'loan')?.assetClass as PlannedClass) ?? null)} /> : null}
        </Rise>
      ) : null}
      {shared ? (
        <Rise index={2}>
          <GlassCard style={styles.shared}>
            <GoalRing progress={(shares.get(shared.id)?.get(line.goalId ?? '') ?? 0)} color={lineColor(line, input)} size={52} stroke={6} />
            <View style={styles.flex}>
              <Label>{shared.name} is shared</Label>
              <Caption>
                {[...(shares.get(shared.id) ?? new Map()).entries()]
                  .map(([gid, s]) => `${(input.goals.find((g) => g.id === gid)?.name ?? '').replace("Child's education", 'Education')} ${Math.round(s * 100)}%`)
                  .join(' · ')}
              </Caption>
            </View>
          </GlassCard>
        </Rise>
      ) : null}
      <Caption style={styles.foot}>These are the funds you hold. Money Plan never picks funds for you.</Caption>
      <Sheet open={pick != null} onClose={() => setPick(null)}>
        <View style={styles.sheet}>
          <Label>Which of yours should take it?</Label>
          {sameKind.map((h) => (
            <Row
              key={h.id}
              title={h.name}
              right={prefs[prefKey(line.goalId ?? '', pick!)] === h.id ? <Caption color={colors.comfortable}>Chosen</Caption> : undefined}
              onPress={async () => {
                await setPref(prefKey(line.goalId ?? '', pick!), h.id);
                setPick(null);
              }}
            />
          ))}
          {pick && prefs[prefKey(line.goalId ?? '', pick)] ? <GhostButton label="Let me choose again each month" onPress={async () => (await setPref(prefKey(line.goalId ?? '', pick), null), setPick(null))} /> : null}
          {sameKind.length <= 1 ? <Caption>Add another holding of this kind in Wealth to have a choice.</Caption> : null}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dotBig: { width: 28, height: 28, borderRadius: 14, marginBottom: 12 },
  label: { marginTop: 20, marginBottom: 8 },
  row: { paddingVertical: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.track, marginTop: 6, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
  shared: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  foot: { marginTop: 20 },
  sheet: { gap: 4 },
});

