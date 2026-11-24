/**
 * PrimaryButton: the one white pill per screen (58px, ink text), pinned near the bottom.
 * Press scale 0.97 + light haptic on press-in. Loading state morphs the pill into a circle with a
 * spinner, then a check. GhostButton: secondary text action below it.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat, withSequence } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { colors, components } from '../theme/tokens';
import { duration, easing, signature, spring } from '../theme/motion';
import { Icon } from './Icon';
import { PressScale } from './Pressable';
import { Body, Label } from './Text';

export type ButtonState = 'idle' | 'loading' | 'done';

export function PrimaryButton({
  label,
  onPress,
  state = 'idle',
  breathe = false,
  pulse = 0,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  state?: ButtonState;
  /** Soft breathing glow (market fall "Keep going"). */
  breathe?: boolean;
  /** Increment to pulse once (check-in "Done" on the last tick). */
  pulse?: number;
  accessibilityHint?: string;
}) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const width = useSharedValue(0);
  const glow = useSharedValue(0);
  const bump = useSharedValue(1);
  const morph = state !== 'idle';

  useEffect(() => {
    if (!w) return;
    const to = morph ? components.primaryButton.height : w;
    width.value = reduce ? to : withSpring(to, spring.gentle);
  }, [morph, w, reduce, width]);

  useEffect(() => {
    if (breathe && !reduce) glow.value = withRepeat(withTiming(1, { duration: signature.breatheGlow, easing: easing.inOut }), -1, true);
    else glow.value = withTiming(0, { duration: duration.fast });
  }, [breathe, reduce, glow]);

  useEffect(() => {
    if (!pulse || reduce) return;
    bump.value = withSequence(withSpring(1.05, spring.press), withSpring(1, spring.bouncy));
  }, [pulse, reduce, bump]);

  const pillStyle = useAnimatedStyle(() => ({
    width: width.value || '100%',
    transform: [{ scale: bump.value }],
    shadowOpacity: 0.15 + glow.value * 0.35,
    shadowRadius: 8 + glow.value * 18,
  }));

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={styles.slot}>
      <PressScale
        haptic="press"
        onPress={state === 'idle' ? onPress : undefined}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ busy: state === 'loading' }}
        style={styles.center}
      >
        <Animated.View style={[styles.pill, pillStyle]}>
          {state === 'idle' ? (
            <Animated.View key="l" entering={FadeIn.duration(duration.fast)} exiting={FadeOut.duration(duration.instant)}>
              <Label color={colors.ink} numberOfLines={1}>
                {label}
              </Label>
            </Animated.View>
          ) : state === 'loading' ? (
            <Animated.View key="s" entering={FadeIn.duration(duration.fast)} exiting={FadeOut.duration(duration.instant)}>
              <ActivityIndicator color={colors.ink} />
            </Animated.View>
          ) : (
            <Animated.View key="c" entering={FadeIn.duration(duration.fast)}>
              <Icon name="check" color={colors.ink} size={24} />
            </Animated.View>
          )}
        </Animated.View>
      </PressScale>
    </View>
  );
}

export function GhostButton({ label, onPress, color = colors.textGhost }: { label: string; onPress?: () => void; color?: string }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.ghost}>
      <Body color={color} center>
        {label}
      </Body>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  slot: { width: '100%' },
  center: { alignItems: 'center' },
  pill: {
    height: components.primaryButton.height,
    borderRadius: components.primaryButton.radius,
    backgroundColor: components.primaryButton.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
  },
  ghost: { minHeight: components.ghostButton.minHeight, justifyContent: 'center', paddingHorizontal: 12 },
});
