/**
 * 4.2 Payday (ember) — signature moment 1. A coin falls into Gullu's slot (catch pose, squash,
 * heavy haptic), the amount counts up, then bubbles burst out of him one by one (80ms apart) and
 * float to their places on springs, sized by √amount, each bobbing on its own phase. Tap a bubble:
 * it expands into Why this amount (shared element).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Amount } from '../../components/Amount';
import { GhostButton, PrimaryButton } from '../../components/Buttons';
import { Rise } from '../../components/Rise';
import { Screen } from '../../components/Screen';
import { Body, Caption } from '../../components/Text';
import { useHabitSkin } from '../../dev/useHabitSkin';
import { paydayPlan } from '../../engine/payday';
import { safetyNet } from '../../engine/plan';
import { Gullu, type GulluHandle } from '../../gullu/Gullu';
import type { Expression } from '../../gullu/geometry';
import { useReduceMotion } from '../../motion/prefs';
import { Bubble, bubbleSize } from '../../motion-kit/Bubble';
import { usePlanInput } from '../../plan/usePlan';
import { requiredMap, startPayday } from '../../state/payday';
import { usePaydayStore } from '../../state/stores';
import { duration, signature } from '../../theme/motion';
import { layout } from '../../theme/tokens';
import { lineColor, lineLabel, whyLine } from './lineMeta';

const GULLU = 200;
const HEADROOM = 0.35;

export function PaydayCatch({ amount }: { amount: number }) {
  const input = usePlanInput();
  const skin = useHabitSkin();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const moves = usePaydayStore((s) => s.moves);
  const plan = useMemo(() => (input ? paydayPlan(input, amount, requiredMap(input)) : null), [input, amount]);
  // Biggest first; on a tie, commitments (PPF) before goals, as on the design.
  const lines = (plan?.lines ?? []).filter((l) => l.amount > 0).sort((a, b) => b.amount - a.amount || Number(b.kind === 'commitment') - Number(a.kind === 'commitment'));
  const max = Math.max(1, ...lines.map((l) => l.amount));
  const [busy, setBusy] = useState(false);

  const gullu = useRef<GulluHandle>(null);
  const [expr, setExpr] = useState<Expression>('catch');
  const [counted, setCounted] = useState(0);
  const [bubbles, setBubbles] = useState(0);
  const [gulluY, setGulluY] = useState(0);
  const [rowY, setRowY] = useState(0);

  useEffect(() => {
    const t = setTimeout(
      () =>
        gullu.current?.catchCoin(() => {
          setExpr('happy');
          setCounted((c) => c + 1);
        }),
      reduce ? 0 : duration.slow,
    );
    return () => clearTimeout(t);
  }, [reduce]);
  useEffect(() => {
    if (!counted) return;
    const t = setTimeout(() => setBubbles((b) => b + 1), reduce ? 0 : duration.slow);
    return () => clearTimeout(t);
  }, [counted, reduce]);

  const showMoves = useCallback(async () => {
    if (!input) return;
    setBusy(true);
    try {
      // Keep a check-in already under way (ticks are saved); otherwise set this month's up.
      if (!moves.some((m) => m.month === input.today)) await startPayday(amount);
      router.push('/payday/check-in');
    } finally {
      setBusy(false);
    }
  }, [input, moves, amount]);

  if (!input || !plan) return null;
  const inner = width - layout.screenPadding.horizontal * 2;
  const col = inner / Math.max(1, lines.length);
  const gulluCentreY = gulluY + GULLU * HEADROOM + GULLU * 0.55;

  return (
    <Screen
      background="ember"
      footer={
        <>
          {/* Known design fix 2: never "what to buy". */}
          <PrimaryButton testID="payday-moves" label="Show me the moves" state={busy ? 'loading' : 'idle'} onPress={showMoves} />
          <GhostButton label="Different amount this month?" onPress={() => router.push('/payday/amount')} />
        </>
      }
    >
      <View style={styles.centre} onLayout={(e) => setGulluY(e.nativeEvent.layout.y)}>
        <Gullu ref={gullu} size={GULLU} expression={expr} skin={skin} headroom={HEADROOM} />
      </View>
      <View style={styles.amount}>
        {counted ? <Amount key={counted} value={amount} variant="big" animate="countUp" countMs={duration.draw} /> : <Amount value={0} variant="big" />}
      </View>
      <Rise index={1}>
        <Body center>{whyLine(input, !!safetyNet(input)?.full)}</Body>
      </Rise>
      <View style={styles.row} onLayout={(e) => setRowY(e.nativeEvent.layout.y)}>
        {lines.map((l, i) => (
          <View key={l.id} style={{ width: col, alignItems: 'center' }}>
            <Bubble
              amount={l.amount}
              label={lineLabel(l)}
              color={lineColor(l, input)}
              diameter={bubbleSize(l.amount, max)}
              from={{ x: inner / 2 - col * (i + 0.5), y: gulluCentreY - (rowY + 32) }}
              delay={i * signature.bubbleGap}
              trigger={bubbles}
              phase={i / lines.length}
              sharedTag={`bubble-${l.id}`}
              onPress={() => router.push({ pathname: '/payday/why/[id]', params: { id: l.id, amount: String(amount) } })}
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
  centre: { alignItems: 'center', marginTop: 0 },
  amount: { alignItems: 'center', marginTop: 4, marginBottom: 4 },
  row: { flexDirection: 'row', marginTop: 24, marginBottom: 16, minHeight: 110 },
});
