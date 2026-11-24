/**
 * Signature moment 3 (part 1) · Home rings (2.1, dusk).
 * Rings fill from 0 on first paint (spring, staggered 80ms). Gullu breathes and blinks; when
 * payday has landed the bar glows and his eyes track it. Pull down: Gullu stretches like a rubber
 * band and the plan recomputes. Tapping a ring zooms it into Goal detail (shared element).
 */
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Body, Caption, H1, Label } from '@/components/Text';
import { TabBar } from '@/components/TabBar';
import { WORD, WORD_COLOR, goalAccent, ringProgress } from '@/dev/labData';
import { useLevel, useStreak } from '@/dev/useHabits';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { Gullu, GulluStill, type GulluHandle } from '@/gullu/Gullu';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useAmbient } from '@/motion/prefs';
import { GoalRing } from '@/motion-kit/GoalRing';
import { usePlan, usePlanInput } from '@/plan/usePlan';
import { useScreenBackground } from '@/state/background';
import { usePaydayStore, useSettingsStore } from '@/state/stores';
import { duration, spring } from '@/theme/motion';
import { colors, layout, radius } from '@/theme/tokens';

const AScrollView = Animated.createAnimatedComponent(ScrollView);
const PULL_MAX = 120;

export default function HomeRings() {
  useScreenBackground('dusk');
  const insets = useSafeAreaInsets();
  const { plan } = usePlan();
  const input = usePlanInput();
  const skin = useHabitSkin();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const landed = usePaydayStore((s) => s.paydays.find((p) => p.placedAt == null));
  const streak = useStreak();
  const level = useLevel();
  const ambient = useAmbient();
  const gullu = useRef<GulluHandle>(null);

  // Payday bar glow, and Gullu watching it.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!landed) return;
    gullu.current?.lookAt(30, 120);
    if (ambient) glow.value = withRepeat(withTiming(1, { duration: duration.celebrate, easing: Easing.inOut(Easing.sin) }), -1, true);
    else cancelAnimation(glow);
    return () => cancelAnimation(glow);
  }, [landed, ambient, glow]);
  const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: 0.25 + 0.45 * glow.value, shadowRadius: 10 + 16 * glow.value }));

  // Pull to refresh: Gullu stretches with the pull and snaps back on release.
  const pull = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      pull.value = Math.min(1, Math.max(0, -e.contentOffset.y / PULL_MAX));
    },
    onEndDrag: () => {
      pull.value = withSpring(0, spring.bouncy);
    },
  });

  if (!plan || !input) return null;
  const focus = plan.goals.find((g) => g.goalId === plan.focus?.goalId);

  return (
    <View style={styles.fill}>
      <AScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + layout.screenPadding.top, paddingHorizontal: layout.screenPadding.horizontal }}
        onScrollEndDrag={(e) => {
          if (e.nativeEvent.contentOffset.y < -PULL_MAX * 0.7) haptics.selection(); // plan recomputes from the stores
        }}
      >
        <View style={styles.header}>
          <PressScale style={styles.chip} accessibilityRole="button" accessibilityLabel="Levels and streak">
            <GulluStill size={34} skin={skin} aura={false} />
            <Body color={colors.text}>
              Level {level} · {streak}-month streak
            </Body>
          </PressScale>
          <Icon name="bell" size={24} />
        </View>
        <Rise index={0}>
          <H1 style={styles.headline}>
            {plan.onTrack} of {plan.total} goals on track.
          </H1>
        </Rise>
        {focus && plan.focus ? (
          <Rise index={1}>
            <Body>
              {focus.name} is {formatINR(Math.round(plan.focus.shortBy / 1e5) * 1e5, { compact: true, hidden })} short. {formatINR(plan.focus.extraMonthly, { hidden })} more a month fixes it.
            </Body>
          </Rise>
        ) : null}
        <View style={styles.gullu}>
          <Gullu ref={gullu} size={190} skin={skin} pull={pull} />
        </View>
        <View style={styles.rings}>
          {plan.goals.map((g, i) => (
            <PressScale
              key={g.goalId}
              style={styles.ring}
              accessibilityRole="button"
              accessibilityLabel={`${g.name}, ${WORD[g.affordability]}`}
              onPress={() => router.push({ pathname: '/dev/moments/goal-detail', params: { id: g.goalId } })}
            >
              <GoalRing progress={ringProgress(g)} color={goalAccent(input, g.goalId)} index={i} sharedTag={`ring-${g.goalId}`} size={68} />
              <Caption color={colors.textGhost} center numberOfLines={1}>
                {g.name === "Child's education" ? 'Education' : g.name}
              </Caption>
              <Caption color={WORD_COLOR[g.affordability]} center>
                {WORD[g.affordability]}
              </Caption>
            </PressScale>
          ))}
        </View>
        <View style={{ height: 160 }} />
      </AScrollView>
      {landed ? (
        <View style={[styles.barWrap]}>
          <Animated.View style={[styles.bar, glowStyle]}>
            <View style={styles.barText}>
              <Amount value={landed.amount} variant="label" weight="800" />
              <Body color={colors.textGhost}> landed</Body>
            </View>
            <PressScale haptic="press" onPress={() => router.push('/dev/moments/payday')} style={styles.place} accessibilityRole="button" accessibilityLabel="Place it">
              <Label color={colors.ink}>Place it</Label>
            </PressScale>
          </Animated.View>
        </View>
      ) : null}
      <TabBar active="home" onSelect={(t) => (t === 'payday' ? router.push('/dev/moments/payday') : undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.glass, borderRadius: radius.pill, paddingVertical: 4, paddingLeft: 4, paddingRight: 14 },
  headline: { marginTop: 32 },
  gullu: { alignItems: 'center', marginTop: 24 },
  rings: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  ring: { alignItems: 'center', flex: 1, gap: 4 },
  barWrap: { paddingHorizontal: layout.screenPadding.horizontal },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(120,30,10,0.55)',
    borderRadius: radius.pill,
    padding: 10,
    paddingLeft: 20,
    shadowColor: colors.short,
    shadowOffset: { width: 0, height: 0 },
  },
  barText: { flexDirection: 'row', alignItems: 'center' },
  place: { backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 22, height: 48, justifyContent: 'center' },
});
