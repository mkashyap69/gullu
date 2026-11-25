/**
 * 7.2 Three buckets (dusk): the retiree's Wealth. Cash, income and growth jars fill and settle
 * with a slow wave; the yearly refill shows as a drop travelling from the income jar to the cash
 * jar. Reduced motion: jars appear filled, no flow.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { Screen } from '@/components/Screen';
import { Row } from '@/components/Surfaces';
import { Body, Caption, H1, Label } from '@/components/Text';
import { formatINR } from '@/lib/formatINR';
import { Jar } from '@/motion-kit/Jar';
import { useAmbient, useReduceMotion } from '@/motion/prefs';
import { useIncomePlan } from '@/plan/useIncomePlan';
import { useSettingsStore } from '@/state/stores';
import { duration, signature } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const GAP = 14;
const MAX_H = 200;

function Flow({ from, to, top }: { from: number; to: number; top: number }) {
  const reduce = useReduceMotion();
  const ambient = useAmbient();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const once = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: duration.calm, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: signature.ambientDrift / 2 }));
    t.value = withDelay(duration.calm, ambient ? withRepeat(once, -1, false) : once);
  }, [reduce, ambient, t]);
  const a = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 1 ? 1 : 0,
    transform: [{ translateX: from + (to - from) * t.value }, { translateY: top - 40 * Math.sin(Math.PI * t.value) }],
  }));
  if (reduce) return null;
  return <Animated.View pointerEvents="none" style={[styles.drop, a]} />;
}

export function Buckets() {
  const p = useIncomePlan();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const [w, setW] = useState(0);
  if (!p) return null;
  const jars = [
    { k: 'Cash', v: p.buckets.cash, d: 'Next 2 years of spending', c: colors.cash },
    { k: 'Income', v: p.buckets.income, d: 'Years 3 to 7, low risk', c: colors.debt },
    { k: 'Growth', v: p.buckets.growth, d: 'Year 8 onwards', c: colors.indianEquity },
  ];
  const max = Math.max(...jars.map((j) => j.v), 1);
  const jw = (w - GAP * 2) / 3;
  // Jar height grows with the bucket (gently, so cash stays visible); each fills to the brim.
  const hOf = (v: number) => Math.max(90, MAX_H * Math.sqrt(v / max));
  const base = MAX_H + 20;
  return (
    <Screen background="dusk" scroll>
      <H1>Your three buckets</H1>
      <Body>A crash only touches the growth bucket. You spend from cash, so you&apos;re never forced to sell low.</Body>
      <View style={[styles.jars, { height: base }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0
          ? jars.map((j, i) => (
              <View key={j.k} style={[styles.jar, { left: i * (jw + GAP), top: base - hOf(j.v) }]}>
                <Jar width={jw} height={hOf(j.v)} fill={0.92} color={j.c} delay={i * duration.base} />
              </View>
            ))
          : null}
        {w > 0 ? <Flow from={jw + GAP + jw / 2 - 5} to={jw / 2 - 5} top={base - hOf(p.buckets.cash) - 12} /> : null}
      </View>
      <View style={styles.labels}>
        {jars.map((j) => (
          <View key={j.k} style={styles.label}>
            <Label>{j.k}</Label>
            <Amount value={j.v} compact variant="body" color={colors.text} />
            <Caption>{j.d}</Caption>
          </View>
        ))}
      </View>
      <Body style={styles.note}>
        Each April, {formatINR(p.refill, { compact: true, hidden })} moves from income to cash. If markets are down, I wait for growth to recover before refilling income.
      </Body>
      <View style={styles.more}>
        <Row title="Holdings" detail="What's in each bucket, and its value" chevron onPress={() => router.push('/wealth/holdings')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  jars: { marginTop: 32 },
  jar: { position: 'absolute' },
  drop: { position: 'absolute', left: 0, top: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.debt },
  labels: { flexDirection: 'row', gap: GAP, marginTop: 12 },
  label: { flex: 1 },
  note: { marginTop: 20 },
  more: { marginTop: 16 },
});
