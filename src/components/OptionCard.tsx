/** An answer card (1.3): presses in to 0.97, and the chosen one turns white with a soft glow. */
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '../motion/haptics';
import { duration } from '../theme/motion';
import { colors, radius } from '../theme/tokens';
import { PressScale } from './Pressable';
import { Body } from './Text';

export function OptionCard({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const t = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    t.value = withTiming(selected ? 1 : 0, { duration: duration.fast });
  }, [selected, t]);
  const a = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [colors.glassStrong, colors.white]),
    shadowOpacity: 0.45 * t.value,
  }));
  return (
    <PressScale
      testID={testID}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.card, a]}>
        <Body color={selected ? colors.ink : colors.text} weight={selected ? '700' : '400'}>
          {label}
        </Body>
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 14, justifyContent: 'center', shadowColor: colors.white, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
});
