/**
 * 2.1 Home (dusk). One headline across all goals, goal rings, the payday bar. Level and streak chip
 * top-left. Rings fill from 0 on first paint (spring, staggered 80ms). Gullu breathes and blinks;
 * when payday has landed the bar glows and his eyes track it. Pull down: Gullu stretches like a
 * rubber band and the plan recomputes. Tapping a ring zooms it into Goal detail (shared element).
 * On focus it shows at most one pending moment: goal day, then market fall, then a milestone.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
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
import { scheduleOnRN } from 'react-native-worklets';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Body, Caption, H1, Label } from '@/components/Text';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { WORD, WORD_COLOR, ringProgress } from '@/dev/labData';
import { effectiveRisk } from '@/engine/plan';
import { marketFall, pendingMilestone, reachedGoal } from '@/engine/moments';
import { Gullu, GulluStill, type GulluHandle } from '@/gullu/Gullu';
import { goalColor } from '@/lib/goalColors';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useAmbient } from '@/motion/prefs';
import { GoalRing } from '@/motion-kit/GoalRing';
import { ringName, useLevel, usePaydayDue, useShown, useStreak } from '@/plan/selectors';
import { usePlan, usePlanInput, usePlanNonce } from '@/plan/usePlan';
import { useScreenBackground } from '@/state/background';
import { useHoldingsStore, useSettingsStore } from '@/state/stores';
import { duration, spring } from '@/theme/motion';
import { colors, layout, radius } from '@/theme/tokens';

const AScrollView = Animated.createAnimatedComponent(ScrollView);
const PULL_MAX = 120;

export default function Home() {
  useScreenBackground('dusk');
  const insets = useSafeAreaInsets();
  const { plan } = usePlan();
  const input = usePlanInput();
  const skin = useHabitSkin();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const due = usePaydayDue();
  const streak = useStreak();
  const level = useLevel();
  const shown = useShown();
  const snapshots = useHoldingsStore((s) => s.snapshots);
  const ambient = useAmbient();
  const gullu = useRef<GulluHandle>(null);
  const bump = usePlanNonce((s) => s.bump);

  // One pending moment per visit, most important first.
  useFocusEffect(
    useCallback(() => {
      if (!input) return;
      const t = setTimeout(() => {
        const reached = reachedGoal(input, shown);
        if (reached) return router.push({ pathname: '/goal/day/[id]', params: { id: reached.goalId } });
        const fall = marketFall(snapshots, effectiveRisk(input.profile), shown);
        if (fall) return router.push('/market-fall');
        const m = pendingMilestone(input, streak, shown);
        if (m) router.push({ pathname: '/milestone', params: { kind: m } });
      }, duration.celebrate);
      return () => clearTimeout(t);
    }, [input, shown, snapshots, streak]),
  );

  // Payday bar glow, and Gullu watching it.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!due) {
      gullu.current?.lookReset();
      return;
    }
    gullu.current?.lookAt(30, 120);
    if (ambient) glow.value = withRepeat(withTiming(1, { duration: duration.celebrate, easing: Easing.inOut(Easing.sin) }), -1, true);
    else cancelAnimation(glow);
    return () => cancelAnimation(glow);
  }, [due, ambient, glow]);
  const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: 0.25 + 0.45 * glow.value, shadowRadius: 10 + 16 * glow.value }));

  // Pull to refresh: Gullu stretches with the pull, snaps back on release, and the plan recomputes.
  const pull = useSharedValue(0);
  const refresh = () => {
    haptics.selection();
    bump();
  };
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      pull.value = Math.min(1, Math.max(0, -e.contentOffset.y / PULL_MAX));
    },
    onEndDrag: () => {
      if (pull.value >= 0.7) scheduleOnRN(refresh);
      pull.value = withSpring(0, spring.bouncy);
    },
  });

  if (!plan || !input) return null;
  const focus = plan.goals.find((g) => g.goalId === plan.focus?.goalId);
  const chip = level > 0 || streak > 0 ? `Level ${level} · ${streak}-month streak` : 'Your first payday starts a streak';

  return (
    <View style={styles.fill}>
      <AScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        alwaysBounceVertical
        contentContainerStyle={{ paddingTop: insets.top + layout.screenPadding.top, paddingHorizontal: layout.screenPadding.horizontal, paddingBottom: 140 }}
      >
        <View style={styles.header}>
          <PressScale style={styles.chip} accessibilityRole="button" accessibilityLabel={chip} onPress={() => router.push('/levels')} testID="home-chip">
            <GulluStill size={34} skin={skin} aura={false} />
            <Body color={colors.text}>{chip}</Body>
          </PressScale>
          <Icon name="bell" size={24} />
        </View>
        <Rise index={0}>
          <H1 style={styles.headline} testID="home-headline">
            {plan.total > 0 ? `${plan.onTrack} of ${plan.total} goals on track.` : 'Add a goal to start.'}
          </H1>
        </Rise>
        <Rise index={1}>
          <Body>
            {focus && plan.focus
              ? plan.focus.shortBy >= 50000
                ? `${focus.name} is ${formatINR(Math.round(plan.focus.shortBy / 1e5) * 1e5, { compact: true, hidden })} short. ${formatINR(plan.focus.extraMonthly, { hidden })} more a month fixes it.`
                : `${focus.name} needs ${formatINR(plan.focus.extraMonthly, { hidden })} more a month to stay on track.`
              : plan.total > 0
                ? 'Every goal is on track.'
                : ''}
          </Body>
        </Rise>
        <View style={styles.gullu}>
          <Gullu ref={gullu} size={190} skin={skin} pull={pull} />
        </View>
        <View style={styles.rings}>
          {plan.goals.map((g, i) => {
            const goal = input.goals.find((x) => x.id === g.goalId)!;
            return (
              <PressScale
                key={g.goalId}
                style={styles.ring}
                accessibilityRole="button"
                accessibilityLabel={`${g.name}, ${WORD[g.affordability]}`}
                testID={`home-ring-${i}`}
                onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.goalId } })}
              >
                <GoalRing progress={ringProgress(g)} color={goalColor(goal)} index={i} sharedTag={`ring-${g.goalId}`} size={68} />
                <Caption color={colors.textGhost} center numberOfLines={1}>
                  {ringName(g.name)}
                </Caption>
                <Caption color={WORD_COLOR[g.affordability]} center>
                  {WORD[g.affordability]}
                </Caption>
              </PressScale>
            );
          })}
        </View>
      </AScrollView>
      {due ? (
        <View style={styles.barWrap}>
          <Animated.View style={[styles.bar, glowStyle]}>
            <View style={styles.barText}>
              <Amount value={due} variant="label" weight="800" />
              <Body color={colors.textGhost}> landed</Body>
            </View>
            <PressScale haptic="press" onPress={() => router.navigate('/payday')} style={styles.place} accessibilityRole="button" accessibilityLabel="Place it" testID="home-place">
              <Label color={colors.ink}>Place it</Label>
            </PressScale>
          </Animated.View>
        </View>
      ) : null}
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
  barWrap: { paddingHorizontal: layout.screenPadding.horizontal, paddingBottom: 8 },
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
