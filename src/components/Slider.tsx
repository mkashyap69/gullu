/** Slider (1.6 yearly raise): drag the thumb; selection haptic on each whole step. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '../motion/haptics';
import { colors } from '../theme/tokens';

const THUMB = 26;

export function Slider({ value, onChange, min, max, step = 1, accessibilityLabel, testID }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; accessibilityLabel: string; testID?: string }) {
  const [w, setW] = useState(0);
  const last = useSharedValue(value);
  last.value = value;
  const set = (v: number) => {
    haptics.selection();
    onChange(v);
  };
  const pick = (x: number) => {
    'worklet';
    const f = Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, w - THUMB)));
    const v = Math.round((min + f * (max - min)) / step) * step;
    if (v !== last.value) {
      last.value = v;
      scheduleOnRN(set, v);
    }
  };
  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      pick(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      pick(e.x);
    },
  });
  const f = (value - min) / (max - min);
  const left = f * Math.max(0, w - THUMB);
  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testID}
        style={styles.hit}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: left + THUMB / 2 }]} />
        </View>
        <View style={[styles.thumb, { left }]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.white },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.white },
});
