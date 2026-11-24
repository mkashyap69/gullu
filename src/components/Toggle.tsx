/** Toggle: the thumb slides on spring.snappy and the track fills; selection haptic on change. */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '../motion/haptics';
import { spring } from '../theme/motion';
import { colors, layout } from '../theme/tokens';
import { PressScale } from './Pressable';
import { Body, Caption } from './Text';

export function Toggle({ value, onChange, label, detail }: { value: boolean; onChange: (v: boolean) => void; label: string; detail?: string }) {
  const t = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    t.value = withSpring(value ? 1 : 0, spring.snappy);
  }, [value, t]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, [0, 1], [colors.track, colors.comfortable]) }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * 20 }] }));
  return (
    <PressScale
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onChange(!value);
      }}
      style={styles.row}
    >
      <View style={styles.text}>
        <Body color={colors.text}>{label}</Body>
        {detail ? <Caption>{detail}</Caption> : null}
      </View>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.thumb, thumb]} />
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: layout.rowMinHeight, flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1 },
  track: { width: 50, height: 30, borderRadius: 15, padding: 3 },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white },
});
