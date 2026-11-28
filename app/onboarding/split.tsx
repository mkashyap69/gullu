/**
 * "Here's how I'd use what you have" — onboarding step after 1.6 (owner direction, 24 Nov 2026).
 * The app suggests how existing money is shared across goals (src/engine/suggestSplit.ts); the user
 * accepts it or changes any goal's amount, and the rest rebalances to Retirement. Copy is drafted.
 * Motion: rows rise staggered, bars grow to their share on spring.gentle, amounts roll on edit.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { AmountField } from '@/components/AmountField';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label } from '@/components/Text';
import { maxForGoal, setGoalAmount, suggestSplit, type GoalSuggestion, type SplitSuggestion } from '@/engine/suggestSplit';
import type { PlanInput } from '@/engine/types';
import { goalColor } from '@/lib/goalColors';
import { formatINR } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { OnboardingTop } from '@/screens/onboarding/OnboardingTop';
import { draftPlan, finishOnboarding, splitInputs, useOnboarding } from '@/state/onboarding';
import { spring, stagger } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const r500 = (v: number) => Math.ceil(v / 500) * 500;

function reasonLine(g: GoalSuggestion, hasLocked: boolean): string {
  switch (g.reason) {
    case 'safetyNet':
      return 'Ready any time, in cash';
    case 'covers':
      return 'Covered. No new money needed';
    case 'lowers':
      return `Needs ${formatINR(r500(g.requiredWith))} a month instead of ${formatINR(r500(g.requiredWithout))}`;
    case 'none':
      return `Grows best from new money: ${formatINR(r500(g.requiredWith))} a month`;
    case 'rest':
      return hasLocked ? 'Everything else, including PPF and EPF' : 'Everything else, growing for later';
  }
}

function ShareBar({ share, index, color }: { share: number; index: number; color: string }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(reduce ? share : 0);
  useEffect(() => {
    w.value = reduce ? share : withDelay(index * stagger.list, withSpring(share, spring.gentle));
  }, [share, index, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, w.value)) * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.bar, { backgroundColor: color }, a]} />
    </View>
  );
}

function EditSheet({ input, sug, goal, onSave }: { input: PlanInput; sug: SplitSuggestion; goal: GoalSuggestion; onSave: (s: SplitSuggestion) => void }) {
  const [amount, setAmount] = useState(Math.round(goal.amount));
  const max = Math.floor(maxForGoal(input, sug, goal.goalId));
  const clamped = Math.min(amount, max);
  const preview = useMemo(() => setGoalAmount(input, sug, goal.goalId, clamped), [input, sug, goal.goalId, clamped]);
  const p = preview.goals.find((x) => x.goalId === goal.goalId)!;
  return (
    <View style={styles.sheet}>
      <Label>{goal.name}</Label>
      <AmountField testID="split-amount" label="From what you have" value={amount} onChange={setAmount} />
      <Caption>Up to {formatINR(max, { compact: true })} fits this goal&apos;s mix.</Caption>
      <Body color={colors.text}>
        {p.requiredWith <= 0 ? 'Then it needs no new money.' : `Then it needs ${formatINR(r500(p.requiredWith))} a month.`}
      </Body>
      <PrimaryButton testID="split-save" label="Save" onPress={() => onSave(preview)} />
    </View>
  );
}

export default function SplitStep() {
  const s = useOnboarding();
  const input = useMemo(() => draftPlan(), [s.holdings, s.goals, s.monthly, s.risk, s.age, s.monthlyExpenses, s.work, s.raisePct]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggested = useMemo(() => suggestSplit(input), [input]);
  const sig = splitInputs(s);
  const stillValid = s.splitEdited && s.split && s.splitFor === sig;
  const sug = stillValid ? s.split! : suggested;
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasLocked = sug.locked.some((v) => v > 0);
  const total = sug.free.reduce((a, b) => a + b, 0) + sug.locked.reduce((a, b) => a + b, 0);
  const editingGoal = sug.goals.find((g) => g.goalId === editing);

  const accept = async () => {
    setBusy(true);
    try {
      s.set({ split: sug });
      await finishOnboarding();
      router.replace('/onboarding/answer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.fill}>
      <Screen
        background="dusk"
        scroll
        footer={
          <>
            <PrimaryButton testID="split-accept" label="Looks right" state={busy ? 'loading' : 'idle'} onPress={accept} />
            {stillValid ? <GhostButton label="Go back to my suggestion" onPress={() => s.set({ split: null, splitEdited: false })} /> : null}
          </>
        }
      >
        <OnboardingTop step="split" />
        <Rise index={0}>
          <H1>Here&apos;s how I&apos;d use what you have.</H1>
          <Body>Short goals get safe money, long goals keep growing. Tap a goal to change it.</Body>
        </Rise>
        <View style={styles.list}>
          {sug.goals.map((g, i) => {
            const goal = input.goals.find((x) => x.id === g.goalId)!;
            const tappable = g.reason !== 'rest';
            const row = (
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: goalColor(goal) }]} />
                <View style={styles.flex}>
                  <View style={styles.top}>
                    <Body color={colors.text} style={styles.flex}>
                      {g.name}
                    </Body>
                    {g.amount > 0 ? <Amount value={g.amount} compact variant="label" weight="800" animate="odometer" /> : <Caption>—</Caption>}
                    {tappable ? <Icon name="chevron" size={18} color={colors.textCaption} /> : null}
                  </View>
                  <Caption>{reasonLine(g, hasLocked)}</Caption>
                  <ShareBar share={total > 0 ? g.amount / total : 0} index={i} color={goalColor(goal)} />
                </View>
              </View>
            );
            return (
              <Rise key={g.goalId} index={Math.min(i + 1, 8)}>
                {tappable ? (
                  <PressScale onPress={() => setEditing(g.goalId)} accessibilityRole="button" accessibilityLabel={`Change ${g.name}`} testID={`split-row-${goal.template}`}>
                    {row}
                  </PressScale>
                ) : (
                  row
                )}
              </Rise>
            );
          })}
        </View>
        <Caption style={styles.summary}>
          {sug.required <= sug.budget
            ? `Your goals then need ${formatINR(r500(sug.required))} a month, and you put in ${formatINR(sug.budget)}.`
            : `Your goals then need ${formatINR(r500(sug.required))} a month, more than the ${formatINR(sug.budget)} left for them${sug.budget < s.monthly ? ` once your ${formatINR(s.monthly - sug.budget)} goes to the safety net and yearly commitments first` : ''}. The next screen shows what to do.`}
        </Caption>
      </Screen>
      <Sheet open={editing != null} onClose={() => setEditing(null)}>
        {editingGoal ? (
          <EditSheet
            key={editingGoal.goalId}
            input={input}
            sug={sug}
            goal={editingGoal}
            onSave={(next) => {
              s.set({ split: next, splitEdited: true, splitFor: sig });
              setEditing(null);
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  list: { marginTop: 20, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 8 },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' },
  bar: { height: 3, borderRadius: 2 },
  summary: { marginTop: 16 },
  sheet: { gap: 12 },
});
