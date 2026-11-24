/**
 * Signature moment 5 · Level up (10.2, ember). The biggest celebration in the app, and rare:
 * the screen dims, Gullu lands, spins once (Y-axis 360°, 900ms), and the gold rim draws on with a
 * shine sweep across his body. Coin and marigold particles fall. Success haptic.
 * Reduced motion: a cross-fade to the new look.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Big, Body, Caption } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import type { Expression, Skin } from '@/gullu/geometry';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { Particles } from '@/motion-kit/Particles';
import { duration, easing, gulluMotion, signature } from '@/theme/motion';
import { colors } from '@/theme/tokens';

export default function LevelUp() {
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const gullu = useRef<GulluHandle>(null);
  const [run, setRun] = useState(1);
  const [skin, setSkin] = useState<Skin>('steady');
  const [expr, setExpr] = useState<Expression>('happy');
  const [rain, setRain] = useState(0);
  const [text, setText] = useState(0);
  const dim = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    setSkin('steady');
    setExpr('happy');
    setText(0);
    shine.value = 0;
    if (reduce) {
      // Cross-fade to the new look, no movement.
      const t = setTimeout(() => {
        setSkin('secure');
        setExpr('celebrate');
        setText((x) => x + 1);
        haptics.success();
      }, duration.base);
      return () => clearTimeout(t);
    }
    // 1. dim
    dim.value = 0;
    dim.value = withSequence(withTiming(signature.scrimOpacity, { duration: duration.slow, easing: easing.out }), withDelay(duration.celebrate, withTiming(0, { duration: duration.slow })));
    const timers: ReturnType<typeof setTimeout>[] = [];
    // 2. land
    timers.push(setTimeout(() => gullu.current?.land(), duration.base));
    // 3. spin; the new look appears while he's turned away
    const spinAt = duration.base + duration.slow + duration.base;
    timers.push(
      setTimeout(
        () =>
          gullu.current?.spin(() => {
            setSkin('secure');
          }),
        spinAt,
      ),
    );
    // 4. rim draws on (skin change triggers the draw), shine sweep, particles, success haptic
    const after = spinAt + gulluMotion.spinDuration;
    timers.push(
      setTimeout(() => {
        shine.value = withTiming(1, { duration: duration.draw, easing: easing.inOut });
        setExpr('celebrate');
        gullu.current?.celebrate();
        setRain((r) => r + 1);
        setText((x) => x + 1);
        haptics.success();
      }, after),
    );
    return () => timers.forEach(clearTimeout);
  }, [run, reduce, dim, shine]);

  const scrim = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <Screen
      background="ember"
      footer={
        <>
          <PrimaryButton label="See Gullu's collection" onPress={() => router.push('/dev/gullu')} />
          <GhostButton label="Share it, amounts hidden" />
        </>
      }
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]} pointerEvents="none" />
      <LabTop onReplay={() => setRun((r) => r + 1)} />
      <View style={styles.hero}>
        <Gullu ref={gullu} key={run} size={230} skin={skin} expression={expr} shine={shine} />
      </View>
      {text ? (
        <Rise index={0} key={text}>
          <Caption center color={colors.textGhost}>
            Level 3 unlocked
          </Caption>
          <Big center>Secure.</Big>
          <Body center color={colors.textGhost}>
            Your safety net is full and you carry no costly debt. Gullu earned a gold rim.
          </Body>
        </Rise>
      ) : null}
      <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
        <Particles trigger={rain} kinds={['coin', 'petal', 'petal']} count={signature.particleBudget} mode="rain" width={width} height={height} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', marginTop: 20, marginBottom: 16 },
});
