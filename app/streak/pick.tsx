/**
 * 10.5 Pick a challenge (violet). Self-set promises; Gullu just keeps count. Options lift when
 * chosen; Start stamps the card, then returns to 10.4. Raise-my-SIP asks for the appraisal month.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/Buttons';
import { Pill } from '@/components/Pill';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { CHALLENGES, isActive, type ChallengeId } from '@/engine/challenges';
import { shortMonth } from '@/engine/habits';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { useChallenges } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { useHabitsStore } from '@/state/stores';
import { duration, signature, spring } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function Option({ name, detail, picked, taken, onPress }: { name: string; detail: string; picked: boolean; taken: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const a = useAnimatedStyle(() => ({ transform: [{ scale: reduce ? 1 : withSpring(picked ? signature.liftScale : 1, spring.snappy) }] }));
  return (
    <PressScale onPress={onPress} disabled={taken} accessibilityRole="radio" accessibilityState={{ selected: picked, disabled: taken }} accessibilityLabel={name}>
      <Animated.View style={[styles.card, picked && styles.picked, taken && styles.taken, a]}>
        <Label weight="800">{name}</Label>
        <Caption>{taken ? 'Already running' : detail}</Caption>
      </Animated.View>
    </PressScale>
  );
}

export default function PickChallenge() {
  const input = usePlanInput();
  const add = useHabitsStore((s) => s.add);
  const running = useChallenges().filter((x) => isActive(x.c) && !x.status.done && !x.status.ended).map((x) => x.c.id);
  const reduce = useReduceMotion();
  const [pick, setPick] = useState<ChallengeId | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [stamped, setStamped] = useState(false);
  const stamp = useSharedValue(0);
  useEffect(() => {
    if (!stamped) return;
    stamp.value = reduce ? 1 : withSequence(withTiming(0, { duration: 0 }), withSpring(1, spring.bouncy));
    const t = setTimeout(() => router.back(), reduce ? duration.base : duration.celebrate);
    return () => clearTimeout(t);
  }, [stamped, reduce, stamp]);
  const stampStyle = useAnimatedStyle(() => ({ opacity: stamp.value > 0 ? 1 : 0, transform: [{ scale: 1.8 - 0.8 * stamp.value }, { rotate: '-8deg' }] }));
  if (!input) return null;
  const options = CHALLENGES.filter((c) => c.pickable);
  const chosen = options.find((c) => c.id === pick);
  const ready = !!chosen && (pick !== 'raiseSip' || month != null);

  const start = async () => {
    if (!chosen) return;
    haptics.success();
    await add({
      kind: 'challenge',
      data: {
        id: chosen.id,
        name: chosen.name,
        target: chosen.target,
        progress: 0,
        done: false,
        start: { month: input.today, monthly: input.profile.monthly, loanIds: input.loans.map((l) => l.id), appraisalMonth: month ?? undefined },
      },
      at: input.today,
    });
    setStamped(true);
  };

  return (
    <Screen background="violet" scroll footer={<PrimaryButton label="Start this challenge" disabled={!ready || stamped} onPress={start} testID="challenge-start" />}>
      <LabTop icon="back" />
      <H1>Pick one you&apos;ll actually do.</H1>
      <Body>Your own promise to yourself. Gullu just keeps count.</Body>
      <View style={styles.list}>
        {options.map((c) => (
          <Option key={c.id} name={c.name} detail={c.detail} picked={pick === c.id} taken={running.includes(c.id)} onPress={() => { haptics.selection(); setPick(c.id); }} />
        ))}
      </View>
      {pick === 'raiseSip' ? (
        <View style={styles.months}>
          <Caption>Which month is your appraisal?</Caption>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}>
            {Array.from({ length: 12 }, (_, i) => input.today + i).map((m) => (
              <Pill key={m} label={shortMonth(m)} selected={month === m} onPress={() => setMonth(m)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Animated.View pointerEvents="none" style={[styles.stamp, stampStyle]}>
        <Label weight="800" color={colors.white}>
          Started
        </Label>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 20, gap: 12 },
  card: { backgroundColor: colors.glass, borderRadius: radius.md, padding: 16, gap: 4, borderWidth: 1.5, borderColor: 'transparent' },
  picked: { borderColor: colors.white, backgroundColor: colors.glassStrong },
  taken: { opacity: 0.5 },
  months: { marginTop: 16, gap: 8 },
  monthRow: { gap: 8 },
  stamp: { position: 'absolute', alignSelf: 'center', top: '40%', borderWidth: 3, borderColor: colors.white, borderRadius: radius.sm, paddingHorizontal: 20, paddingVertical: 8 },
});
