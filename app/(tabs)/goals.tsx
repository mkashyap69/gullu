/**
 * 3.1 Goals (violet). All goals by date: affordability word, required vs actual, date ranges,
 * priority. The list staggers in; the dot pulses once on Stretch rows; required-vs-actual is a thin
 * bar that fills to actual with a ghost marker at required; long-press to reorder.
 */
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { ReorderList } from '@/components/ReorderList';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1, Label } from '@/components/Text';
import { WORD, WORD_COLOR, ringProgress } from '@/dev/labData';
import { labelWithRange, labelYM, ymYear } from '@/engine/dates';
import { retirementDate } from '@/engine/plan';
import type { Goal, GoalResult, PlanInput } from '@/engine/types';
import { goalColor } from '@/lib/goalColors';
import { formatINR } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { GoalRing } from '@/motion-kit/GoalRing';
import { usePlan, usePlanInput } from '@/plan/usePlan';
import { useGoalsStore, useSettingsStore } from '@/state/stores';
import { duration, spring, stagger } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const PRIORITY_LABEL = { must: 'must', should: 'should', nice: 'nice to have' } as const;

/** "₹12,500 a month, needs ₹16,000" / "₹3,000 a month, as needed" (research change 2). */
export function monthlyLine(r: GoalResult, hidden: boolean): string {
  const a = formatINR(r.actualMonthly, { hidden });
  if (r.requiredMonthly == null) return `${a} a month`;
  if (r.requiredMonthly === 0) return r.actualMonthly > 0 ? `${a} a month, needs none` : 'No new money needed';
  if (r.actualMonthly === r.requiredMonthly) return `${a} a month, as needed`;
  return `${a} a month, needs ${formatINR(r.requiredMonthly, { hidden })}`;
}

export function dateLine(g: Goal, r: GoalResult, input: PlanInput): string {
  if (g.isRetirement && g.retirement) return `At ${g.retirement.retireAge}, in ${ymYear(retirementDate(g, input))} · ${PRIORITY_LABEL[g.priority]}`;
  const when = r.dateRange && r.projectedDate != null ? labelWithRange(r.projectedDate, r.dateRange) : labelYM(g.date);
  return `${when} · ${PRIORITY_LABEL[g.priority]}`;
}

function DualBar({ actual, required, index }: { actual: number; required: number | null; index: number }) {
  const reduce = useReduceMotion();
  const max = Math.max(actual, required ?? 0, 1);
  const f = actual / max;
  const w = useSharedValue(reduce ? f : 0);
  useEffect(() => {
    w.value = reduce ? f : withDelay(index * stagger.list, withSpring(f, spring.gentle));
  }, [f, index, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.dual}>
      <Animated.View style={[styles.dualFill, a]} />
      {required ? <View style={[styles.ghost, { left: `${Math.min(1, required / max) * 100}%` }]} /> : null}
    </View>
  );
}

function StatusDot({ word, index }: { word: GoalResult['affordability']; index: number }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (word === 'stretch' && !reduce) s.value = withDelay(index * stagger.list + duration.slow, withSequence(withTiming(1.8, { duration: duration.base }), withSpring(1, spring.bouncy)));
  }, [word, index, reduce, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: WORD_COLOR[word] }, a]} />;
}

function GoalRow({ g, r, index, input, hidden }: { g: Goal; r: GoalResult; index: number; input: PlanInput; hidden: boolean }) {
  return (
    <PressScale onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id } })} accessibilityRole="button" accessibilityLabel={`${g.name}, ${WORD[r.affordability]}`} testID={`goal-row-${index}`}>
      <View style={styles.row}>
        <GoalRing progress={ringProgress(r)} color={goalColor(g)} size={60} stroke={6} index={index} sharedTag={`ring-${g.id}`} />
        <View style={styles.flex}>
          <Label numberOfLines={1}>{g.name}</Label>
          {/* Known design fix 5: truncate the range text before the amount. */}
          <Caption numberOfLines={1}>{dateLine(g, r, input)}</Caption>
          <Caption numberOfLines={2}>{monthlyLine(r, hidden)}</Caption>
          <DualBar actual={r.actualMonthly} required={r.requiredMonthly} index={index} />
          <View style={styles.wordRow}>
            <StatusDot word={r.affordability} index={index} />
            <Caption color={WORD_COLOR[r.affordability]}>{WORD[r.affordability]}</Caption>
          </View>
        </View>
        <View style={styles.right}>
          {g.isRetirement && g.retirement ? (
            <Label style={styles.amountText}>{formatINR(g.retirement.targetMonthly, { compact: true, hidden })} a month</Label>
          ) : (
            <Amount value={g.targetToday} compact variant="label" weight="800" />
          )}
        </View>
      </View>
    </PressScale>
  );
}

export default function Goals() {
  const input = usePlanInput();
  const { plan } = usePlan();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const custom = useSettingsStore((s) => s.customGoalOrder);
  const reorder = useGoalsStore((s) => s.reorder);

  const rows = useMemo(() => {
    if (!input || !plan) return [];
    const list = plan.goals.map((r) => ({ r, g: input.goals.find((x) => x.id === r.goalId)! }));
    if (custom) return list.sort((a, b) => input.goals.indexOf(a.g) - input.goals.indexOf(b.g));
    const when = (g: Goal) => (g.isRetirement ? retirementDate(g, input) : g.date);
    return list.sort((a, b) => when(a.g) - when(b.g)); // soonest first
  }, [input, plan, custom]);

  if (!input || !plan) return null;
  const sn = plan.safetyNet;
  const done = input.goals.filter((g) => g.status === 'reached');

  return (
    <Screen background="violet" scroll>
      <View style={styles.header}>
        <Rise index={0}>
          <H1>Goals</H1>
        </Rise>
        <PressScale style={styles.add} onPress={() => router.push('/goal/edit')} accessibilityRole="button" accessibilityLabel="Add a goal" testID="goals-add" haptic="press">
          <Icon name="plus" size={24} color={colors.ink} />
        </PressScale>
      </View>
      <Body>{custom ? 'In today’s rupees, in your order.' : "In today's rupees, soonest first."}</Body>
      <View style={styles.list}>
        <ReorderList
          items={rows}
          keyOf={(x) => x.g.id}
          onReorder={(next) => reorder(next.map((x) => x.g.id))}
          render={(x, i) => (
            <Rise index={Math.min(i + 1, 8)}>
              <GoalRow g={x.g} r={x.r} index={i} input={input} hidden={hidden} />
            </Rise>
          )}
        />
        {sn ? (
          <Rise index={Math.min(rows.length + 1, 8)}>
            <View style={[styles.row, styles.safety]}>
              <GoalRing progress={sn.target > 0 ? Math.min(1, sn.current / sn.target) : 1} color={colors.cash} size={60} stroke={6} />
              <View style={styles.flex}>
                <Label>Safety net</Label>
                <Caption>Always first</Caption>
              </View>
              <View style={styles.wordRow}>
                <View style={[styles.dot, { backgroundColor: colors.cash }]} />
                <Body color={colors.text}>{sn.full ? 'Full' : `${formatINR(sn.target - sn.current, { compact: true, hidden })} to go`}</Body>
              </View>
            </View>
          </Rise>
        ) : null}
        {done.map((g) => (
          <View key={g.id} style={[styles.row, styles.safety]}>
            <GoalRing progress={1} color={goalColor(g)} size={60} stroke={6} />
            <View style={styles.flex}>
              <Label>{g.name}</Label>
              <Caption>Reached {labelYM(g.date)}</Caption>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  add: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  list: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  safety: { opacity: 0.85 },
  flex: { flex: 1, gap: 2 },
  right: { maxWidth: 96, alignItems: 'flex-end' },
  amountText: { textAlign: 'right' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dual: { height: 3, borderRadius: 2, backgroundColor: colors.track, marginTop: 6, marginBottom: 4 },
  dualFill: { height: 3, borderRadius: 2, backgroundColor: colors.white },
  ghost: { position: 'absolute', top: -3, width: 2, height: 9, marginLeft: -1, borderRadius: 1, backgroundColor: colors.stretch },
});
