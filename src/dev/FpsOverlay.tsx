/** Dev overlay: frames per second on the UI thread (04-MOTION.md performance budget). */
import { StyleSheet, TextInput } from 'react-native';
import Animated, { useAnimatedProps, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function FpsOverlay() {
  const insets = useSafeAreaInsets();
  const fps = useSharedValue(60);
  const acc = useSharedValue(0);
  const frames = useSharedValue(0);
  const worst = useSharedValue(0);
  useFrameCallback((f) => {
    'worklet';
    const dt = f.timeSincePreviousFrame ?? 16;
    acc.value += dt;
    frames.value += 1;
    worst.value = Math.max(worst.value, dt);
    if (acc.value >= 500) {
      fps.value = Math.round((frames.value * 1000) / acc.value);
      acc.value = 0;
      frames.value = 0;
      worst.value = 0;
    }
  });
  const props = useAnimatedProps(() => ({ text: `${fps.value} fps` }) as unknown as Record<string, unknown>);
  return <AnimatedTextInput editable={false} pointerEvents="none" animatedProps={props} defaultValue="60 fps" style={[styles.fps, { top: insets.top + 4 }]} />;
}

const styles = StyleSheet.create({
  fps: {
    position: 'absolute',
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#3BE08A',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
