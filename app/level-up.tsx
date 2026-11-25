/**
 * 10.2 Level up (ember) — signature moment 5, the biggest celebration, at most once per level.
 * The screen dims, Gullu lands, spins once (the new look appears while he's turned away), the rim
 * draws on with a shine sweep; coins and marigolds fall; success haptic. Reduced motion: a
 * cross-fade to the new look. Copy for Secure is verbatim; the other levels are drafted.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Big, Body, Caption } from '@/components/Text';
import { ShareSheet } from '@/share/ShareSheet';
import { LabTop } from '@/dev/LabTop';
import { LEVELS } from '@/engine/habits';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import type { Expression, Skin } from '@/gullu/geometry';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { Particles } from '@/motion-kit/Particles';
import { duration, easing, gulluMotion, signature } from '@/theme/motion';
import { colors } from '@/theme/tokens';

export const LEVEL_COPY: Record<number, string> = {
  1: 'Your first payday is placed. Every goal starts here.',
  2: 'Your safety net covers 3 months. Gullu earned a teal band.',
  3: 'Your safety net is full and you carry no costly debt. Gullu earned a gold rim.',
  4: 'A year of paydays, and every goal funded. Gullu earned marigolds.',
  5: 'Your investments cover half your retirement. Gullu earned a gold zigzag.',
  6: 'Your retirement is fully covered. Gullu is all gold.',
};

export default function LevelUp() {
  const { n = '3', preview } = useLocalSearchParams<{ n?: string; preview?: string }>();
  const level = LEVELS[Math.max(1, Math.min(6, Number(n))) - 1];
  const before: Skin = level.n > 1 ? LEVELS[level.n - 2].skin : 'base';
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const gullu = useRef<GulluHandle>(null);
  const [run, setRun] = useState(1);
  const [share, setShare] = useState(false);
  const [skin, setSkin] = useState<Skin>(before);
  const [expr, setExpr] = useState<Expression>('happy');
  const [rain, setRain] = useState(0);
  const [text, setText] = useState(0);
  const dim = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    setSkin(before);
    setExpr('happy');
    setText(0);
    shine.value = 0;
    if (reduce) {
      const t = setTimeout(() => {
        setSkin(level.skin);
        setExpr('celebrate');
        setText(1);
        haptics.success();
      }, duration.base);
      return () => clearTimeout(t);
    }
    dim.value = withSequence(withTiming(signature.scrimOpacity, { duration: duration.slow, easing: easing.out }), withDelay(duration.celebrate, withTiming(0, { duration: duration.slow })));
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => gullu.current?.land(), duration.base));
    const spinAt = duration.base + duration.slow + duration.base;
    timers.push(setTimeout(() => gullu.current?.spin(() => setSkin(level.skin)), spinAt));
    timers.push(
      setTimeout(() => {
        shine.value = withTiming(1, { duration: duration.draw, easing: easing.inOut });
        setExpr('celebrate');
        gullu.current?.celebrate();
        setRain((r) => r + 1);
        setText((x) => x + 1);
        haptics.success();
      }, spinAt + gulluMotion.spinDuration),
    );
    return () => timers.forEach(clearTimeout);
  }, [run, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrim = useAnimatedStyle(() => ({ opacity: dim.value }));
  return (
    <View style={styles.shareWrap}>
    <Screen
      background="ember"
      footer={
        <>
          <PrimaryButton label="See Gullu's collection" onPress={() => router.replace('/collection')} />
          <GhostButton label="Share it, amounts hidden" onPress={() => setShare(true)} />
        </>
      }
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]} pointerEvents="none" />
      <LabTop onReplay={preview ? () => setRun((r) => r + 1) : undefined} />
      <View style={styles.hero}>
        <Gullu ref={gullu} key={run} size={230} skin={skin} expression={expr} shine={shine} />
      </View>
      {text ? (
        <Rise index={0} key={text}>
          <Caption center color={colors.textGhost}>
            Level {level.n} unlocked
          </Caption>
          <Big center>{level.name}.</Big>
          <Body center color={colors.textGhost}>
            {LEVEL_COPY[level.n]}
          </Body>
        </Rise>
      ) : null}
      <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
        <Particles trigger={rain} kinds={['coin', 'petal', 'petal']} count={signature.particleBudget} mode="rain" width={width} height={height} />
      </View>
    </Screen>
    <ShareSheet card={{ kind: 'levelUp', title: `Level ${level.n}: ${level.name}.`, line: LEVEL_COPY[level.n] }} open={share} onClose={() => setShare(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shareWrap: { flex: 1 },
  scrim: { backgroundColor: colors.scrim },
  hero: { alignItems: 'center', marginTop: 20, marginBottom: 16 },
});
