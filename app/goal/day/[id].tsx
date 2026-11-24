/**
 * 3.5 Goal day (ember). The goal is reached: spend, move to cash, or roll over. Gullu celebrates,
 * the goal ring completes its final arc and bursts into coins; the three options rise in after
 * 400ms. The only place an exclamation mark is allowed (03-DESIGN-SYSTEM voice rules).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OptionCard } from '@/components/OptionCard';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, H1 } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { labelYM } from '@/engine/dates';
import { goalBalances } from '@/engine/plan';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { goalColor } from '@/lib/goalColors';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { GoalRing } from '@/motion-kit/GoalRing';
import { Particles } from '@/motion-kit/Particles';
import { usePlanInput } from '@/plan/usePlan';
import { useGoalsStore, useHabitsStore, useHoldingsStore, useSettingsStore } from '@/state/stores';
import { duration } from '@/theme/motion';

const RING = 120;

export default function GoalDay() {
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>();
  const input = usePlanInput();
  const skin = useHabitSkin();
  const reduce = useReduceMotion();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const add = useHabitsStore((s) => s.add);
  const upsertGoal = useGoalsStore((s) => s.upsertGoal);
  const holdingsStore = useHoldingsStore();
  const gullu = useRef<GulluHandle>(null);
  const [burst, setBurst] = useState(0);
  const [ring, setRing] = useState(0.86);
  const goal = input?.goals.find((g) => g.id === id);
  const amount = useMemo(() => (input && goal ? (goalBalances(input).get(goal.id) ?? []).reduce((a, b) => a + b, 0) : 0), [input, goal]);

  useEffect(() => {
    if (!preview && goal && input) add({ kind: 'moment', data: { key: `goal-${goal.id}` }, at: input.today }).catch(() => undefined);
    // The ring completes its final arc, then bursts into coins.
    const t1 = setTimeout(() => setRing(1), reduce ? 0 : duration.fast);
    const t2 = setTimeout(() => {
      setBurst(1);
      gullu.current?.celebrate();
      haptics.success();
    }, reduce ? 0 : duration.slow + duration.base);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!input || !goal) return null;
  const done = () => router.replace('/goals');

  const markSpent = async () => {
    // The money was used: take the goal's share out of each holding and drop its splits.
    for (const hg of input.holdingGoals.filter((x) => x.goalId === goal.id)) {
      const h = input.holdings.find((x) => x.id === hg.holdingId);
      if (!h) continue;
      await holdingsStore.upsertHolding({ ...h, value: Math.max(0, h.value * (1 - hg.pct / 100)), valueAt: input.today });
      await holdingsStore.setSplit(h.id, input.holdingGoals.filter((x) => x.holdingId === h.id && x.goalId !== goal.id));
    }
    await upsertGoal({ ...goal, status: 'spent', monthly: 0 });
    done();
  };

  return (
    <Screen background="ember">
      <LabTop />
      <View style={styles.hero}>
        <View style={styles.ring}>
          <GoalRing progress={ring} color={goalColor(goal)} size={RING + 120} stroke={6} />
        </View>
        <Gullu ref={gullu} size={RING + 60} skin={skin} expression="celebrate" aura={false} />
        <Particles trigger={burst} kinds={['coin']} count={30} width={RING + 160} height={RING + 160} origin={{ x: (RING + 160) / 2, y: 30 }} />
      </View>
      <Rise index={0}>
        <H1 center>{goal.name} is paid for!</H1>
        <Body center>
          {formatINR(amount, { compact: true, hidden })}, ready in {labelYM(goal.date)}. What should happen to it?
        </Body>
      </Rise>
      <Rise index={1} delay={reduce ? 0 : duration.slow} style={styles.options}>
        <OptionCard
          testID="goalday-cash"
          selected
          label={goal.template === 'travel' ? 'Move it to cash for the trip' : 'Move it to cash, ready to use'}
          onPress={async () => {
            await upsertGoal({ ...goal, status: 'reached', monthly: 0 });
            done();
          }}
        />
        <OptionCard testID="goalday-spent" selected={false} label="Mark it as spent" onPress={markSpent} />
        <OptionCard testID="goalday-roll" selected={false} label="Roll it into a new goal" onPress={() => router.replace({ pathname: '/goal/edit', params: { rollFrom: goal.id } })} />
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center', height: RING + 160, marginBottom: 12 },
  ring: { position: 'absolute' },
  options: { gap: 12, marginTop: 24 },
});
