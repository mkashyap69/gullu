/**
 * Signature moment 4 (part 1) · Check in (4.4, ember).
 * Ticking a row: the check path draws, the row slides 4px and dims, "4 of 7" rolls and the top
 * progress ring advances (medium haptic per tick). On the last tick Gullu hops and Done pulses.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Amount, RollingText } from '@/components/Amount';
import { PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, H1 } from '@/components/Text';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { movesByHolding, movesThisMonth, splitPayday } from '@/engine/plan';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { GoalRing } from '@/motion-kit/GoalRing';
import { usePlanInput } from '@/plan/usePlan';
import { usePaydayStore, useSettingsStore } from '@/state/stores';
import { duration, easing, spring } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const CHECK_SVG = 'M14 24.5l6.5 6.5L34 17.5';
const CLASS_COLOR = { cash: colors.cash, debt: colors.debt, indianEquity: colors.indianEquity, globalEquity: colors.globalEquity, gold: colors.gold } as const;

function Tick({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? (done ? 1 : 0) : withTiming(done ? 1 : 0, { duration: duration.base, easing: easing.out });
  }, [done, reduce, t]);
  const fill = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.6 + 0.4 * t.value }] }));
  const check = useMemo(() => Skia.Path.MakeFromSVGString(CHECK_SVG)!, []);
  return (
    <PressScale onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label} style={styles.tick}>
      <View style={styles.tickRing} />
      <Animated.View style={[styles.tickFill, fill]} />
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path path={check} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" color={colors.ink} start={0} end={t} />
      </Canvas>
    </PressScale>
  );
}

function MoveRow({ name, amount, color, done, onToggle, index }: { name: string; amount: number; color: string; done: boolean; onToggle: () => void; index: number }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (done ? 1 : 0) : withSpring(done ? 1 : 0, spring.snappy);
  }, [done, reduce, s]);
  const rowStyle = useAnimatedStyle(() => ({ opacity: 1 - 0.35 * s.value, transform: [{ translateX: 4 * s.value }] }));
  return (
    <Rise index={index} delay={0}>
      <Animated.View style={[styles.row, rowStyle]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Body color={colors.text} style={styles.name} numberOfLines={1}>
          {name}
        </Body>
        <Amount value={amount} variant="label" weight="800" />
        <Tick done={done} onPress={onToggle} label={name} />
      </Animated.View>
    </Rise>
  );
}

export default function CheckIn() {
  const input = usePlanInput();
  const skin = useHabitSkin();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const landed = usePaydayStore((s) => s.paydays.find((p) => p.placedAt == null));
  const amount = landed?.amount ?? input?.profile.monthly ?? 0;
  const moves = useMemo(() => (input ? movesByHolding(movesThisMonth(input, splitPayday(input, amount))) : []), [input, amount]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(0);
  const gullu = useRef<GulluHandle>(null);
  const count = done.size;
  const total = moves.length;

  const toggle = (key: string) => {
    setDone((d) => {
      const n = new Set(d);
      if (n.has(key)) n.delete(key);
      else {
        n.add(key);
        haptics.tick();
        if (n.size === total) {
          gullu.current?.hop();
          setPulse((p) => p + 1);
        }
      }
      return n;
    });
  };

  if (!input) return null;
  const sum = moves.reduce((a, m) => a + m.amount, 0);
  return (
    <Screen
      background="ember"
      scroll
      footer={<PrimaryButton label="Done" pulse={pulse} onPress={() => router.push('/dev/moments/receipt')} />}
    >
      <View style={styles.top}>
        <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={26} />
        </PressScale>
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
        {moves.map((m, i) => {
          const key = m.holdingId || m.assetClass;
          const name = input.holdings.find((h) => h.id === m.holdingId)?.name ?? m.assetClass;
          return <MoveRow key={key} index={Math.min(i, 8)} name={name} amount={m.amount} color={CLASS_COLOR[m.assetClass]} done={done.has(key)} onToggle={() => toggle(key)} />;
        })}
      </View>
    </Screen>
  );
}


const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { marginTop: 16, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1 },
  tick: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tickRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' },
  tickFill: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white },
});
