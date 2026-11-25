/**
 * 4.4 Check in (ember). Tick each move as you do it in your apps; tap the amount if it was
 * different. Ticking: the check path draws, the row slides 4px and dims, "x of 7" rolls and the top
 * ring advances (medium haptic). On the last tick Gullu hops and Done pulses. Ticks are saved, so a
 * check-in can be finished later. Done places the payday, then the quick value check.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Amount, RollingText } from '@/components/Amount';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/Buttons';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label } from '@/components/Text';
import { TickCircle } from '@/components/TickCircle';
import type { CheckMove } from '@/data/repo';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { GoalRing } from '@/motion-kit/GoalRing';
import { usePlanInput } from '@/plan/usePlan';
import { placePayday } from '@/state/payday';
import { usePaydayStore, useSettingsStore } from '@/state/stores';
import { spring } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const CLASS_COLOR: Record<string, string> = { cash: colors.cash, debt: colors.debt, indianEquity: colors.indianEquity, globalEquity: colors.globalEquity, gold: colors.gold, loan: colors.short };

function MoveRow({ m, name, index, onToggle, onEdit }: { m: CheckMove; name: string; index: number; onToggle: () => void; onEdit: () => void }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(m.done ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (m.done ? 1 : 0) : withSpring(m.done ? 1 : 0, spring.snappy);
  }, [m.done, reduce, s]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - 0.35 * s.value, transform: [{ translateX: 4 * s.value }] }));
  return (
    <Rise index={Math.min(index, 8)}>
      <Animated.View style={[styles.row, style]}>
        <View style={[styles.dot, { backgroundColor: CLASS_COLOR[m.assetClass] ?? colors.white }]} />
        <Body color={colors.text} style={styles.name} numberOfLines={1}>
          {name}
        </Body>
        <PressScale onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Change the amount for ${name}`} testID={`checkin-amount-${index}`}>
          <Amount value={m.actual} variant="label" weight="800" color={m.actual !== m.planned ? colors.stretch : colors.text} />
        </PressScale>
        <PressScale onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: m.done }} accessibilityLabel={name} testID={`checkin-tick-${index}`}>
          <TickCircle done={m.done} />
        </PressScale>
      </Animated.View>
    </Rise>
  );
}

export default function CheckIn() {
  const input = usePlanInput();
  const skin = useHabitSkin();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const all = usePaydayStore((s) => s.moves);
  const updateMove = usePaydayStore((s) => s.updateMove);
  const [pulse, setPulse] = useState(0);
  const [edit, setEdit] = useState<CheckMove | null>(null);
  const [draft, setDraft] = useState(0);
  const [busy, setBusy] = useState(false);
  const gullu = useRef<GulluHandle>(null);
  // "Already done" from the payday notification: tick every move, so Done goes straight on.
  const allDone = useLocalSearchParams<{ all?: string }>().all === '1';
  const today = input?.today;
  useEffect(() => {
    if (!allDone || today == null) return;
    const mine = all.filter((m) => m.month === today && !m.done);
    if (!all.some((m) => m.month === today)) router.replace('/payday');
    for (const m of mine) updateMove(today, m.key, { done: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, today]);
  if (!input) return null;
  const month = input.today;
  const moves = all.filter((m) => m.month === month);
  const count = moves.filter((m) => m.done).length;
  const total = moves.length;
  const sum = moves.reduce((a, m) => a + m.actual, 0);
  const name = (m: CheckMove) => input.holdings.find((h) => h.id === m.holdingId)?.name ?? (m.assetClass === 'loan' ? input.loans.find((l) => `loan:${l.id}` === m.key)?.name ?? 'Loan' : `New ${m.assetClass} holding`);

  const toggle = async (m: CheckMove) => {
    const next = !m.done;
    if (next) haptics.tick();
    await updateMove(month, m.key, { done: next });
    if (next && count + 1 === total) {
      gullu.current?.hop();
      setPulse((p) => p + 1);
    }
  };

  const done = async () => {
    setBusy(true);
    try {
      const r = await placePayday(month);
      router.replace({ pathname: '/payday/values', params: { levels: r.levels.map((l) => l.n).join(','), festival: r.festival ?? '' } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.fill}>
      <Screen background="ember" scroll footer={<PrimaryButton testID="checkin-done" label="Done" pulse={pulse} disabled={count === 0} state={busy ? 'loading' : 'idle'} onPress={done} />}>
        <View style={styles.top}>
          <LabTop icon="back" />
          <View style={styles.progress}>
            <GoalRing progress={total ? count / total : 0} color={colors.white} size={26} stroke={3} />
            <RollingText text={`${count}`} variant="body" color={colors.textBody} />
            <Body> of {total} done</Body>
            <Gullu ref={gullu} size={44} skin={skin} aura={false} />
          </View>
        </View>
        <Rise index={0}>
          <H1>
            {total} moves, {formatINR(sum, { hidden })}.
          </H1>
          <Body>Tick each one as you do it in your apps. Tap the amount if it was different.</Body>
        </Rise>
        <View style={styles.list}>
          {moves.map((m, i) => (
            <MoveRow key={m.key} m={m} name={name(m)} index={i} onToggle={() => toggle(m)} onEdit={() => (setDraft(m.actual), setEdit(m))} />
          ))}
        </View>
        {count > 0 && count < total ? <Caption style={styles.note}>Done places what you ticked. The rest can wait for next month.</Caption> : null}
      </Screen>
      <Sheet open={edit != null} onClose={() => setEdit(null)}>
        {edit ? (
          <View style={styles.sheet}>
            <Label>{name(edit)}</Label>
            <AmountField testID="checkin-actual" label="What went in" value={draft} onChange={setDraft} />
            <Caption>Planned {formatINR(edit.planned, { hidden })}.</Caption>
            <PrimaryButton
              label="Save"
              onPress={async () => {
                await updateMove(month, edit.key, { actual: draft, done: draft > 0 ? true : edit.done });
                setEdit(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'absolute', right: 0 },
  list: { marginTop: 16, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1 },
  note: { marginTop: 8 },
  sheet: { gap: 12 },
});
