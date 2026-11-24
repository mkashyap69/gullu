/** The round tick: the fill grows in and the check path draws (stroke trim). */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { duration, easing } from '../theme/motion';
import { colors } from '../theme/tokens';

const CHECK_SVG = 'M14 24.5l6.5 6.5L34 17.5';

export function TickCircle({ done }: { done: boolean }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? (done ? 1 : 0) : withTiming(done ? 1 : 0, { duration: duration.base, easing: easing.out });
  }, [done, reduce, t]);
  const fill = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.6 + 0.4 * t.value }] }));
  const check = useMemo(() => Skia.Path.MakeFromSVGString(CHECK_SVG)!, []);
  return (
    <View style={styles.box} pointerEvents="none">
      <View style={styles.ring} />
      <Animated.View style={[styles.fill, fill]} />
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={check} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" color={colors.ink} start={0} end={t} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' },
  fill: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white },
});
