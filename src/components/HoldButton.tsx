/**
 * Hold to confirm (8.3 "Delete everything"): a ring fills while held (2s); letting go early
 * empties it. A heavy haptic when it completes. The hold is a safety step, so it stays with reduced
 * motion; only the ring's ease-back is skipped.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '../motion/haptics';
import { useReduceMotion } from '../motion/prefs';
import { duration, signature } from '../theme/motion';
import { colors } from '../theme/tokens';
import { PressScale } from './Pressable';
import { Label } from './Text';

const SIZE = 40;

export function HoldButton({ label, onConfirm, color = colors.short, testID }: { label: string; onConfirm: () => void; color?: string; testID?: string }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);
  const ring = useMemo(() => Skia.PathBuilder.Make().addArc(Skia.XYWHRect(3, 3, SIZE - 6, SIZE - 6), -90, 359.9).build(), []);
  const done = () => {
    haptics.heavy();
    onConfirm();
  };
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold for two seconds"
      testID={testID}
      onPressIn={() => {
        haptics.press();
        p.value = withTiming(1, { duration: signature.holdConfirm, easing: Easing.linear }, (fin) => {
          if (fin) scheduleOnRN(done);
        });
      }}
      onPressOut={() => {
        if (p.value >= 1) return;
        cancelAnimation(p);
        p.value = reduce ? 0 : withTiming(0, { duration: duration.fast });
      }}
      style={styles.row}
    >
      <View style={styles.ring}>
        <Canvas style={{ width: SIZE, height: SIZE }} pointerEvents="none">
          <Path path={ring} style="stroke" strokeWidth={3} color={colors.track} />
          <Path path={ring} style="stroke" strokeWidth={3} strokeCap="round" color={color} start={0} end={p} />
        </Canvas>
      </View>
      <Label color={color}>{label}</Label>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  ring: { width: SIZE, height: SIZE },
});
