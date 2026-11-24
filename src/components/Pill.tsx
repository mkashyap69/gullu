/**
 * Pill and SegmentedPills. The selected background is one shared element that slides between
 * options on spring.snappy (layout animation), with a selection haptic on each change.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '../motion/haptics';
import { useReduceMotion } from '../motion/prefs';
import { spring } from '../theme/motion';
import { colors, components } from '../theme/tokens';
import { PressScale } from './Pressable';
import { Label } from './Text';

export function Pill({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.pill, selected ? styles.pillOn : styles.pillOff]}>
      <Label color={selected ? colors.ink : colors.text}>{label}</Label>
    </PressScale>
  );
}

export function SegmentedPills<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const reduce = useReduceMotion();
  const [frames, setFrames] = useState<Record<string, { x: number; y: number; width: number }>>({});
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const f = frames[value];
  useEffect(() => {
    if (!f) return;
    if (w.value === 0 || reduce) {
      x.value = f.x;
      y.value = f.y;
      w.value = f.width;
    } else {
      x.value = withSpring(f.x, spring.snappy);
      y.value = withSpring(f.y, spring.snappy);
      w.value = withSpring(f.width, spring.snappy);
    }
  }, [f, reduce, x, y, w]);
  const bg = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }], width: w.value, opacity: w.value > 0 ? 1 : 0 }));
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      <Animated.View style={[styles.selectedBg, bg]} />
      {options.map((o) => (
        <PressScale
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => {
            if (o.value !== value) {
              haptics.selection();
              onChange(o.value);
            }
          }}
          onLayout={(e: LayoutChangeEvent) => {
            const { x: lx, y: ly, width } = e.nativeEvent.layout;
            setFrames((fr) => ({ ...fr, [o.value]: { x: lx, y: ly, width } }));
          }}
          style={styles.option}
        >
          <Label color={o.value === value ? colors.ink : colors.text}>{o.label}</Label>
        </PressScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: components.pill.height,
    paddingHorizontal: components.pill.paddingH,
    borderRadius: components.pill.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: components.pill.on.bg },
  pillOff: { backgroundColor: colors.glassStrong },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderRadius: components.pill.radius },
  selectedBg: { position: 'absolute', left: 0, top: 0, height: components.pill.height, borderRadius: components.pill.radius, backgroundColor: colors.white },
  option: {
    height: components.pill.height,
    paddingHorizontal: components.pill.paddingH,
    borderRadius: components.pill.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
