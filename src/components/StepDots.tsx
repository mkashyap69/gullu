/** Onboarding step dots: the active dot widens from 8 to 22px on spring.snappy. */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { spring } from '../theme/motion';
import { colors } from '../theme/tokens';

function Dot({ state }: { state: 'done' | 'active' | 'todo' }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(state === 'active' ? 22 : 8);
  useEffect(() => {
    const to = state === 'active' ? 22 : 8;
    w.value = reduce ? to : withSpring(to, spring.snappy);
  }, [state, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: state === 'todo' ? colors.track : colors.white }, a]} />;
}

export function StepDots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Step ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} state={i < active ? 'done' : i === active ? 'active' : 'todo'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
});
