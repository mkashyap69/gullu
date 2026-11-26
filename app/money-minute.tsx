/**
 * 10.6 Money minute (violet). One card a week, three options. The right answer turns green with a
 * check that draws; the explanation expands and Gullu nods. A wrong pick shakes softly (no red, no
 * penalty) and the right one is shown kindly. Never affects levels or streaks.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1 } from '@/components/Text';
import { TickCircle } from '@/components/TickCircle';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { ymYear } from '@/engine/dates';
import { planGoals } from '@/engine/plan';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { WEEK_MS, MINUTE_CARDS, cardQuestion } from '@/lib/moneyMinute';
import { ringName } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { haptics } from '@/motion/haptics';
import { softShake } from '@/motion/shake';
import { useReduceMotion } from '@/motion/prefs';
import { useHabitsStore } from '@/state/stores';
import { duration } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function Option({ text, state, onPress, i }: { text: string; state: 'idle' | 'right' | 'wrong' | 'dim'; onPress: () => void; i: number }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (state === 'wrong' && !reduce) x.value = softShake();
  }, [state, reduce, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <PressScale onPress={onPress} disabled={state !== 'idle'} accessibilityRole="button" accessibilityLabel={text} testID={`minute-option-${i}`}>
      <Animated.View style={[styles.option, state === 'right' && styles.right, state === 'dim' && styles.dim, a]}>
        <Body color={state === 'right' ? colors.ink : colors.text} style={styles.fill}>
          {text}
        </Body>
        {state === 'right' ? <TickCircle done /> : null}
      </Animated.View>
    </PressScale>
  );
}

export default function MoneyMinute() {
  const input = usePlanInput();
  const events = useHabitsStore((s) => s.events);
  const add = useHabitsStore((s) => s.add);
  const skin = useHabitSkin();
  const reduce = useReduceMotion();
  const gullu = useRef<GulluHandle>(null);
  const [now] = useState(() => Date.now());
  const answers = useMemo(() => events.flatMap((e) => (e.kind === 'minute' ? [e.data] : [])).sort((a, b) => a.card - b.card), [events]);
  const last = answers.at(-1);
  const ready = !last || last.ts == null || now - last.ts >= WEEK_MS;
  const n = Math.min(MINUTE_CARDS.length, ready ? answers.length + 1 : (last?.card ?? 1));
  const done = !ready || answers.length >= MINUTE_CARDS.length;
  const [picked, setPicked] = useState<number | null>(done && last ? (last.correct ? MINUTE_CARDS[n - 1].answer : -1) : null);
  if (!input) return null;
  const card = MINUTE_CARDS[n - 1];
  const order = { must: 0, should: 1, nice: 2 } as const;
  const goal = planGoals(input).filter((g) => !g.isRetirement).sort((a, b) => order[a.priority] - order[b.priority] || a.date - b.date)[0];
  const q = cardQuestion(card, goal ? { name: ringName(goal.name), year: ymYear(goal.date) } : null);
  const revealed = picked != null;

  const choose = async (i: number) => {
    const correct = i === card.answer;
    setPicked(i);
    if (correct) {
      haptics.success();
      gullu.current?.hop();
    } else haptics.selection();
    if (!done) await add({ kind: 'minute', data: { card: n, correct, ts: now }, at: input.today });
  };
  const stateOf = (i: number): 'idle' | 'right' | 'wrong' | 'dim' => {
    if (!revealed) return 'idle';
    if (i === card.answer) return 'right';
    return i === picked ? 'wrong' : 'dim';
  };

  return (
    <Screen background="violet" scroll footer={revealed ? <PrimaryButton label="Back home" onPress={() => router.dismissTo('/home')} /> : undefined}>
      <LabTop icon="close" />
      <View style={styles.head}>
        <View style={styles.fill}>
          <Caption>
            Card {n} of {MINUTE_CARDS.length}
          </Caption>
          <Body color={colors.text}>This week&apos;s money minute</Body>
        </View>
        <Gullu ref={gullu} size={84} skin={skin} expression={revealed && picked === card.answer ? 'happy' : 'think'} aura={false} />
      </View>
      <H1 style={styles.q}>{q}</H1>
      <View style={styles.options}>
        {card.options.map((o, i) => (
          <Option key={o} i={i} text={o} state={stateOf(i)} onPress={() => choose(i)} />
        ))}
      </View>
      {revealed ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(duration.slow)} style={styles.why}>
          <Body color={colors.text}>{picked === card.answer ? card.why : `The answer is: ${card.options[card.answer].toLowerCase()}. ${card.why.replace(/^Right\. /, '')}`}</Body>
          <GhostButton label={`More on “${card.learn}” in Learn`} onPress={() => router.push('/you/learn')} />
          <Caption>Next card next week</Caption>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  q: { marginTop: 16 },
  options: { marginTop: 24, gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.glass },
  right: { backgroundColor: colors.comfortable },
  dim: { opacity: 0.5 },
  why: { marginTop: 20, gap: 8 },
});
