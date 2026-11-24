/**
 * Long-press to reorder (04-MOTION.md "Lists"): the row lifts (scale 1.03 + shadow) with a light
 * haptic, follows the finger, neighbours slide out of the way on spring.snappy, and each slot change
 * gives a selection haptic. Rows may be different heights. Plain taps still reach the row.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '../motion/haptics';
import { useReduceMotion } from '../motion/prefs';
import { signature, spring } from '../theme/motion';

const LONG_PRESS = 350;

function slotsAfterMove(order: number[], heights: number[], dragged: number, centerY: number): number[] {
  'worklet';
  const rest = order.filter((i) => i !== dragged);
  let y = 0;
  let at = rest.length;
  for (let s = 0; s < rest.length; s++) {
    const h = heights[rest[s]] ?? 0;
    if (centerY < y + h / 2) {
      at = s;
      break;
    }
    y += h;
  }
  rest.splice(at, 0, dragged);
  return rest;
}

function topOf(order: number[], heights: number[], item: number): number {
  'worklet';
  let y = 0;
  for (let s = 0; s < order.length; s++) {
    if (order[s] === item) return y;
    y += heights[order[s]] ?? 0;
  }
  return y;
}

function Row({
  index,
  count,
  order,
  heights,
  active,
  drag,
  onHeight,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  order: SharedValue<number[]>;
  heights: SharedValue<number[]>;
  active: SharedValue<number>;
  drag: SharedValue<number>;
  onHeight: (i: number, h: number) => void;
  onDrop: (order: number[]) => void;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const lift = useSharedValue(0);
  const startTop = useSharedValue(0);
  const pan = usePanGesture({
    activateAfterLongPress: LONG_PRESS,
    onActivate: () => {
      'worklet';
      active.value = index;
      startTop.value = topOf(order.value, heights.value, index);
      lift.value = withSpring(1, spring.snappy);
      scheduleOnRN(haptics.light);
    },
    onUpdate: (e) => {
      'worklet';
      if (active.value !== index) return;
      drag.value = e.translationY;
      const center = startTop.value + e.translationY + (heights.value[index] ?? 0) / 2;
      const next = slotsAfterMove(order.value, heights.value, index, center);
      if (next.join() !== order.value.join()) {
        order.value = next;
        scheduleOnRN(haptics.selection);
      }
    },
    onDeactivate: () => {
      'worklet';
      if (active.value !== index) return;
      scheduleOnRN(onDrop, order.value);
    },
    onFinalize: () => {
      'worklet';
      if (active.value === index) active.value = -1;
      drag.value = 0;
      lift.value = withSpring(0, spring.snappy);
    },
  });
  const style = useAnimatedStyle(() => {
    const natural = topOf(
      Array.from({ length: count }, (_, i) => i),
      heights.value,
      index,
    );
    const isActive = active.value === index;
    const target = isActive ? startTop.value + drag.value : topOf(order.value, heights.value, index);
    const dy = target - natural;
    return {
      zIndex: isActive ? 10 : 0,
      shadowOpacity: 0.35 * lift.value,
      transform: [{ translateY: isActive || reduce ? dy : withSpring(dy, spring.snappy) }, { scale: 1 + (signature.liftScale - 1) * lift.value }],
    };
  });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ shadowColor: '#000', shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, style]} onLayout={(e) => onHeight(index, e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export function ReorderList<T>({ items, keyOf, render, onReorder }: { items: T[]; keyOf: (t: T) => string; render: (t: T, i: number) => ReactNode; onReorder: (next: T[]) => void }) {
  const n = items.length;
  const order = useSharedValue<number[]>(Array.from({ length: n }, (_, i) => i));
  const heights = useSharedValue<number[]>(new Array(n).fill(0));
  const active = useSharedValue(-1);
  const drag = useSharedValue(0);
  const [, force] = useState(0);
  const keys = items.map(keyOf).join('|');
  useEffect(() => {
    // New items or a committed reorder: back to the natural order.
    order.value = Array.from({ length: n }, (_, i) => i);
    force((x) => x + 1);
  }, [keys, n, order]);
  const onHeight = (i: number, h: number) => {
    const next = heights.value.slice();
    next[i] = h;
    heights.value = next;
  };
  const onDrop = (o: number[]) => {
    if (o.every((v, i) => v === i)) return;
    onReorder(o.map((i) => items[i]));
  };
  return (
    <View>
      {items.map((t, i) => (
        <Row key={keyOf(t)} index={i} count={n} order={order} heights={heights} active={active} drag={drag} onHeight={onHeight} onDrop={onDrop}>
          {render(t, i)}
        </Row>
      ))}
    </View>
  );
}
