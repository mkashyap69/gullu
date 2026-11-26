// motion-audit: direct manipulation (the movement follows the user's own touch, so it stays with reduced motion)
/**
 * Press feedback for everything tappable (04-MOTION.md): scale to 0.97 on press-in with
 * spring.press and back on release. Optional haptic on press-in (not on release).
 */
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '../motion/haptics';
import { signature, spring } from '../theme/motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  haptic?: keyof typeof haptics | null;
  pressScale?: number;
};

export function PressScale({ style, children, haptic = null, pressScale = signature.pressScale, onPressIn, onPressOut, ...rest }: Props) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        s.value = withSpring(pressScale, spring.press);
        if (haptic) haptics[haptic]();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, spring.press);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[a, style]}>{children}</Animated.View>
    </Pressable>
  );
}
