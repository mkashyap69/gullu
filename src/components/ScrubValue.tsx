/**
 * A value you drag sideways to change (the age wheel on 1.2, the amount dial on 1.6). Digits roll
 * like an odometer; each step gives a selection haptic (or one every `tickEvery` steps). Screen
 * readers get increment/decrement actions instead of the drag.
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '../motion/haptics';
import { RollingText } from './Amount';
import { textStyle } from './Text';

export function ScrubValue({
  value,
  onChange,
  min,
  max,
  step = 1,
  pxPerStep = 14,
  tickEvery = 1,
  format,
  variant = 'label',
  accessibilityLabel,
  testID,
  style,
  typeable = false,
}: {
  /** Tap the value to type it instead (also how Maestro sets it). */
  typeable?: boolean;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  pxPerStep?: number;
  tickEvery?: number;
  format: (v: number) => string;
  variant?: 'label' | 'big' | 'h1';
  accessibilityLabel: string;
  testID?: string;
  style?: ViewStyle;
}) {
  const start = useSharedValue(value);
  const last = useSharedValue(value);
  const latest = useRef(value);
  latest.current = value;
  const set = (v: number) => {
    if (v === latest.current) return;
    if (Math.round(v / step) % tickEvery === 0) haptics.selection();
    onChange(v);
  };
  const pan = usePanGesture({
    minDistance: 4,
    onBegin: () => {
      'worklet';
      start.value = last.value;
    },
    onUpdate: (e) => {
      'worklet';
      const raw = start.value + Math.round(e.translationX / pxPerStep) * step;
      const v = Math.min(max, Math.max(min, raw));
      if (v !== last.value) {
        last.value = v;
        scheduleOnRN(set, v);
      }
    },
  });
  last.value = value;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const commit = () => {
    const n = Number(text.replace(/[^\d]/g, ''));
    if (n) onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
    setEditing(false);
  };
  if (editing) {
    return (
      <TextInput
        testID={testID ? `${testID}-input` : undefined}
        autoFocus
        value={text}
        onChangeText={setText}
        onSubmitEditing={commit}
        onBlur={commit}
        keyboardType="number-pad"
        returnKeyType="done"
        accessibilityLabel={accessibilityLabel}
        style={[textStyle(variant === 'big' ? 'big' : variant === 'h1' ? 'h1' : 'label', '#FFFFFF', '800'), styles.input, style]}
      />
    );
  }
  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.hit, style]}
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => set(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
      >
        {typeable ? (
          <Pressable onPress={() => (setText(String(value)), setEditing(true))} testID={testID ? `${testID}-tap` : undefined}>
            <RollingText text={format(value)} variant={variant} weight="800" />
          </Pressable>
        ) : (
          <RollingText text={format(value)} variant={variant} weight="800" />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ hit: { minHeight: 44, justifyContent: 'center' }, input: { minWidth: 60, textAlign: 'right', padding: 0 } });
