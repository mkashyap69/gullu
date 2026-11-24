/**
 * Signature moment 1 · Payday catch (4.2, ember).
 * A gold ₹ coin falls from the top; Gullu watches it and catches it in his slot (squash, heavy
 * haptic); ₹55,000 counts up; then the bubbles pop out of Gullu one by one (80ms apart) and float
 * on springs to their places, each sized by √amount with its own bob phase (light tick per bubble).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Amount } from '@/components/Amount';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, Caption } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { paydaySlices } from '@/dev/labData';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import type { Expression } from '@/gullu/geometry';
import { useReduceMotion } from '@/motion/prefs';
import { Bubble, bubbleSize } from '@/motion-kit/Bubble';
import { usePlanInput } from '@/plan/usePlan';
import { usePaydayStore } from '@/state/stores';
import { duration, signature } from '@/theme/motion';
import { layout } from '@/theme/tokens';

const GULLU = 200;
const HEADROOM = 0.35;

export default function PaydayMoment() {
  const input = usePlanInput();
  const skin = useHabitSkin();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const landed = usePaydayStore((s) => s.paydays.find((p) => p.placedAt == null));
  const amount = landed?.amount ?? input?.profile.monthly ?? 0;
  const slices = useMemo(() => (input ? paydaySlices(input, amount) : []), [input, amount]);
  const max = Math.max(1, ...slices.map((s) => s.amount));

  const gullu = useRef<GulluHandle>(null);
  const [expr, setExpr] = useState<Expression>('catch');
  const [run, setRun] = useState(0); // replays the whole moment
  const [counted, setCounted] = useState(0); // count-up trigger
  const [bubbles, setBubbles] = useState(0); // bubble trigger
  const [gulluY, setGulluY] = useState(0);
  const [rowY, setRowY] = useState(0);

  const start = useCallback(() => {
    setExpr('catch');
    setCounted(0);
    setBubbles(0);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (!run) return;
    const t = setTimeout(
      () =>
        gullu.current?.catchCoin(() => {
          setExpr('happy');
          setCounted((c) => c + 1);
        }),
      reduce ? 0 : duration.slow,
    );
    return () => clearTimeout(t);
  }, [run, reduce]);

  // Bubbles pop once the count-up has mostly landed.
  useEffect(() => {
    if (!counted) return;
    const t = setTimeout(() => setBubbles((b) => b + 1), reduce ? 0 : duration.slow);
    return () => clearTimeout(t);
  }, [counted, reduce]);

  const inner = width - layout.screenPadding.horizontal * 2;
  const col = inner / Math.max(1, slices.length);
  // Offset from each bubble's resting centre back to Gullu's slot, so they burst out of him.
  const gulluCentreY = gulluY + GULLU * HEADROOM + GULLU * 0.55;

  return (
    <Screen
      background="ember"
      footer={
        <>
          <PrimaryButton label="Show me the moves" onPress={() => router.push('/dev/moments/check-in')} />
          <GhostButton label="Different amount this month?" />
        </>
      }
    >
      <LabTop onReplay={start} />
      <View style={styles.centre} onLayout={(e) => setGulluY(e.nativeEvent.layout.y)}>
        <Gullu ref={gullu} size={GULLU} expression={expr} skin={skin} headroom={HEADROOM} />
      </View>
      <View style={styles.amount}>
        {counted ? <Amount key={counted} value={amount} variant="big" animate="countUp" countMs={duration.draw} /> : <Amount value={0} variant="big" />}
      </View>
      <Rise index={1}>
        <Body center>Every rupee gets a job. Your safety net is full and the car loan is cheap, so it goes here.</Body>
      </Rise>
      <View style={styles.row} onLayout={(e) => setRowY(e.nativeEvent.layout.y)}>
        {slices.map((s, i) => (
          <View key={s.id} style={{ width: col, alignItems: 'center' }}>
            <Bubble
              amount={s.amount}
              label={s.label}
              color={s.color}
              diameter={bubbleSize(s.amount, max)}
              from={{ x: inner / 2 - col * (i + 0.5), y: gulluCentreY - (rowY + 32) }}
              delay={i * signature.bubbleGap}
              trigger={bubbles}
              phase={i / slices.length}
              sharedTag={`bubble-${s.id}`}
            />
          </View>
        ))}
      </View>
      <Rise index={3}>
        <Caption center>Tap a goal to see why it gets that amount.</Caption>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  centre: { alignItems: 'center', marginTop: -24 },
  amount: { alignItems: 'center', marginTop: 4, marginBottom: 4 },
  row: { flexDirection: 'row', marginTop: 24, marginBottom: 16, minHeight: 110 },
});
