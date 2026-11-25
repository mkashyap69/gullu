/**
 * 8.4 Learn (night). Gullu's one-card explainers: tap a card and it flips (rotateY) to its meaning.
 * Reduced motion: the card cross-fades instead of flipping.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GhostButton } from '@/components/Buttons';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { GulluStill } from '@/gullu/Gullu';
import { LEARN } from '@/lib/learn';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { duration, spring } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function Card({ term, meaning }: { term: string; meaning: string }) {
  const reduce = useReduceMotion();
  const [open, setOpen] = useState(false);
  const t = useSharedValue(0);
  const flip = () => {
    haptics.selection();
    setOpen(!open);
    t.value = reduce ? withTiming(open ? 0 : 1, { duration: duration.fast }) : withSpring(open ? 0 : 1, spring.snappy);
  };
  const front = useAnimatedStyle(() =>
    reduce
      ? { opacity: 1 - t.value }
      : {
          opacity: t.value < 0.5 ? 1 : 0,
          transform: [{ perspective: 800 }, { rotateY: `${interpolate(t.value, [0, 1], [0, 180])}deg` }],
        },
  );
  const back = useAnimatedStyle(() =>
    reduce
      ? { opacity: t.value }
      : {
          opacity: t.value >= 0.5 ? 1 : 0,
          transform: [{ perspective: 800 }, { rotateY: `${interpolate(t.value, [0, 1], [-180, 0])}deg` }],
        },
  );
  return (
    <View style={styles.cell}>
      <PressScale
        onPress={flip}
        style={styles.press}
        accessibilityRole="button"
        accessibilityLabel={open ? `${term}: ${meaning}` : term}
        accessibilityHint="Shows what it means"
      >
        <Animated.View style={[styles.face, front]}>
          <Label weight="800">{term}</Label>
        </Animated.View>
        <Animated.View style={[styles.face, styles.back, back]}>
          <Body color={colors.text}>{meaning}</Body>
        </Animated.View>
      </PressScale>
    </View>
  );
}

export default function Learn() {
  const [all, setAll] = useState(false);
  const cards = all ? LEARN : LEARN.slice(0, 4);
  return (
    <Screen
      background="night"
      scroll
      footer={
        all ? undefined : (
          <GhostButton label={`See all ${LEARN.length}`} color={colors.text} onPress={() => setAll(true)} />
        )
      }
    >
      <LabTop icon="back" />
      <View style={styles.head}>
        <H1 style={styles.fill}>Ask me what a word means.</H1>
        <GulluStill size={72} expression="think" aura={false} />
      </View>
      <View style={styles.grid}>
        {cards.map((c) => (
          <Card key={c.term} {...c} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  cell: { width: '47.5%', height: 132 },
  press: { width: '100%', height: 132 },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    padding: 16,
    justifyContent: 'flex-end',
    backfaceVisibility: 'hidden',
  },
  back: { backgroundColor: colors.glassStrong, justifyContent: 'center' },
});
