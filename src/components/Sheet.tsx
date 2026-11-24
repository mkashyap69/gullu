/**
 * Bottom sheet: rises on spring.gentle over a scrim that fades to 60%; drag down or tap the scrim
 * to dismiss. Rendered as an overlay inside the screen, so there is no native modal stack.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useReduceMotion } from '../motion/prefs';
import { duration, signature, spring } from '../theme/motion';
import { colors, gradients, radius } from '../theme/tokens';

const OFF = 700;

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const y = useSharedValue(OFF);
  const scrim = useSharedValue(0);
  useEffect(() => {
    if (open) {
      setMounted(true);
      y.value = reduce ? 0 : withSpring(0, spring.gentle);
      scrim.value = withTiming(signature.scrimOpacity, { duration: duration.base });
    } else if (mounted) {
      scrim.value = withTiming(0, { duration: duration.base });
      y.value = withTiming(OFF, { duration: duration.base }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [open, reduce, mounted, y, scrim]);
  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      y.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 800) scheduleOnRN(onClose);
      else y.value = withSpring(0, spring.gentle);
    },
  });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.end} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={styles.grabArea}>
              <View style={styles.grab} />
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#07060D' },
  end: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: gradients.night.colors[2], borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 24 },
  grabArea: { alignItems: 'center', paddingVertical: 10 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.track },
});
