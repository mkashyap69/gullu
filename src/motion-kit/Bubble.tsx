/**
 * Payday bubble: a goal's share of the money, sized by √amount, with its own idle bob phase.
 * It pops out of Gullu (from `from`, relative offset) and floats to its place on spring.bouncy.
 * Tapping it expands into Why this amount (shared element via `sharedTag`).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '../motion/haptics';
import { useAmbient, useReduceMotion } from '../motion/prefs';
import { Amount } from '../components/Amount';
import { PressScale } from '../components/Pressable';
import { Caption } from '../components/Text';
import { duration, signature, spring } from '../theme/motion';
import { colors } from '../theme/tokens';

/** Diameter for an amount, scaled by √ against the largest. */
export const bubbleSize = (amount: number, max: number, maxD = 64, minD = 30) => Math.max(minD, maxD * Math.sqrt(amount / max));

export function Bubble({
  amount,
  label,
  color,
  diameter,
  from,
  delay = 0,
  trigger,
  phase = 0,
  sharedTag,
  onPress,
}: {
  amount: number;
  label: string;
  color: string;
  diameter: number;
  /** Where Gullu is, relative to this bubble's resting place (px). */
  from: { x: number; y: number };
  delay?: number;
  /** Increment to replay the pop-out. */
  trigger: number;
  /** Idle bob phase 0..1 so bubbles don't bob in sync. */
  phase?: number;
  sharedTag?: string;
  onPress?: () => void;
}) {
  const reduce = useReduceMotion();
  const ambient = useAmbient();
  const t = useSharedValue(trigger ? 0 : 1);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    if (reduce) {
      t.value = 0;
      t.value = withDelay(delay, withTiming(1, { duration: duration.fast }));
      return;
    }
    t.value = 0;
    t.value = withDelay(delay, withSpring(1, spring.bouncy));
    const id = setTimeout(() => haptics.light(), delay);
    return () => clearTimeout(id);
  }, [trigger, delay, reduce, t]);

  useEffect(() => {
    if (!ambient) {
      cancelAnimation(bob);
      bob.value = withTiming(0, { duration: duration.fast });
      return;
    }
    // Each bubble starts its gentle bob at its own phase.
    const half = signature.bubbleBobPeriod / 2;
    bob.value = withDelay(
      phase * half,
      withRepeat(withSequence(withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: half, easing: Easing.inOut(Easing.sin) })), -1, true),
    );
    return () => cancelAnimation(bob);
  }, [ambient, phase, bob]);

  const flyStyle = useAnimatedStyle(() => {
    const k = t.value;
    if (reduce) return { opacity: k };
    return {
      opacity: Math.min(1, k * 3),
      transform: [{ translateX: from.x * (1 - k) }, { translateY: from.y * (1 - k) + bob.value * signature.bubbleBobPx }, { scale: 0.2 + 0.8 * k }],
    };
  });

  return (
    <Animated.View style={[styles.wrap, flyStyle]}>
      <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}`} style={styles.center} testID={`bubble-${label}`}>
        <View style={{ height: 64, justifyContent: 'center' }}>
          <Animated.View
            sharedTransitionTag={sharedTag}
            style={[styles.bubble, { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: color, shadowColor: color }]}
          />
        </View>
        <Amount value={amount} variant="label" weight="800" color={colors.text} style={styles.amount} />
        <Caption style={styles.label} numberOfLines={1}>
          {label}
        </Caption>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  center: { alignItems: 'center', gap: 2 },
  amount: { fontSize: 15, letterSpacing: -0.3 },
  label: { fontSize: 13 },
  bubble: { shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
});
